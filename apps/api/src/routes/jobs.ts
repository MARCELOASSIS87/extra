import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import {
  DISCRIMINATORY_MESSAGE,
  discriminatoryMatches,
  JOBS_PAGE_SIZE,
  jobPostSchema,
  publicJobsQuerySchema,
} from "@extra/shared/schemas/job";
import type { ApiResult, Paginated } from "@extra/shared/types/api";
import type { PublicJobPost } from "@extra/shared/types/job";
import { maxApplicationsFor } from "@extra/shared/lib/job";
import { prisma } from "../db.js";
import { countRoutedWorkers } from "../routing.js";
import { failure, success } from "../http.js";
import { publicReadRateLimit } from "../rate-limit.js";
import { requireCompany } from "../auth/session.js";
import { jobReachCountQuerySchema } from "@extra/shared/schemas/job";

/**
 * Cabeçalhos para o ISR do Next (§4.1). A listagem muda toda vez que alguém
 * publica; o detalhe só muda quando aquela vaga muda, e é a página que o
 * Google indexa — por isso vive mais.
 */
const LIST_CACHE = "public, s-maxage=60, stale-while-revalidate=300";
const DETAIL_CACHE = "public, s-maxage=300, stale-while-revalidate=3600";

/**
 * Nome da empresa e nome da cidade entram por join, não por consulta dentro
 * de laço: o Prisma resolve as duas relações em número fixo de statements,
 * independente de quantas vagas voltarem — e há um teste que trava isso.
 */
export const jobInclude = {
  company: { select: { tradeName: true } },
  city: { select: { name: true, slug: true } },
} as const;

type JobRow = Prisma.JobPostGetPayload<{ include: typeof jobInclude }>;

export const toPublicJobPost = (job: JobRow): PublicJobPost => ({
  id: job.id,
  slug: job.slug,
  companyId: job.companyId,
  cityId: job.cityId,
  role: job.role,
  title: job.title,
  description: job.description,
  startsAt: job.startsAt.toISOString(),
  endsAt: job.endsAt.toISOString(),
  payAmount: job.payAmount.toNumber(),
  payNote: job.payNote,
  address: job.address,
  neighborhood: job.neighborhood,
  requirements: job.requirements,
  providesTransport: job.providesTransport,
  reach: job.reach,
  reachRadiusKm: job.reachRadiusKm,
  vacancies: job.vacancies,
  applicationsCount: job.applicationsCount,
  // Nunca calculado solto: `vacancies * 3` mora em `lib/job.ts` e em lugar
  // nenhum mais, senão o teto passa a existir em duas versões.
  maxApplications: maxApplicationsFor(job.vacancies),
  // A vaga vence sozinha na passagem do instante. Derivar aqui é o que faz a
  // listagem e o detalhe contarem a mesma história antes de o cron rodar.
  status:
    job.status === "open" && job.expiresAt.getTime() <= Date.now()
      ? "expired"
      : job.status,
  isHighlighted: job.isHighlighted,
  publishedAt: job.publishedAt.toISOString(),
  expiresAt: job.expiresAt.toISOString(),
  companyName: job.company.tradeName,
  cityName: job.city.name,
  citySlug: job.city.slug,
});

/**
 * O slug da URL, tirado do título. Único DENTRO da cidade, nunca no país:
 * "garcom-para-formatura" pode — e deve — existir em Poços e em Andradas ao
 * mesmo tempo, e é o par (cidade, slug) que a URL carrega.
 */
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140);

/**
 * O slug base quando está livre, e `-2`, `-3`… quando não está. Uma consulta,
 * não uma por tentativa: pega de uma vez tudo que já começa com a base
 * naquela cidade.
 *
 * Sufixo numérico e não aleatório porque a URL é a página que o Google indexa
 * — a segunda "Garçom para formatura" da cidade merece um endereço legível,
 * não seis caracteres de ruído.
 */
async function nextFreeSlug(cityId: string, title: string): Promise<string> {
  const base = slugify(title) || "vaga";

  const taken = new Set(
    (
      await prisma.jobPost.findMany({
        where: { cityId, slug: { startsWith: base } },
        select: { slug: true },
      })
    ).map((job) => job.slug),
  );

  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Assinatura que não publica. `trialing` e `active` publicam normalmente. */
const CANNOT_PUBLISH: ReadonlySet<string> = new Set(["suspended", "cancelled"]);

export function registerJobRoutes(app: FastifyInstance): void {
  /**
   * Listagem pública (§8): só vaga aberta e não vencida, em ordem de começo —
   * quem procura bico procura o próximo, não o mais recente.
   */
  app.get(
    "/v1/jobs",
    { onRequest: publicReadRateLimit },
    async (request, reply) => {
      const query = publicJobsQuerySchema.parse(request.query);
      const page = query.page ?? 1;

      let cityId: string | undefined;
      if (query.city) {
        const city = await prisma.city.findUnique({
          where: { slug: query.city },
          select: { id: true },
        });
        // Slug que não existe é 404, nunca lista vazia. Lista vazia por erro
        // de digitação faz a pessoa concluir que não há vaga na cidade dela —
        // e quem conclui isso não reclama, some.
        if (!city) {
          return reply
            .status(404)
            .send(failure("city_not_found", "Cidade não encontrada.", "city"));
        }
        cityId = city.id;
      }

      // `from` e `to` chegam como instante em UTC e são usados como instante.
      // Fuso é assunto do front (§17): a API não converte para São Paulo.
      const startsAt =
        query.from || query.to
          ? {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            }
          : undefined;

      const where = {
        status: "open",
        expiresAt: { gt: new Date() },
        ...(cityId ? { cityId } : {}),
        ...(query.role ? { role: query.role } : {}),
        ...(startsAt ? { startsAt } : {}),
      } satisfies Prisma.JobPostWhereInput;

      const [rows, total] = await Promise.all([
        prisma.jobPost.findMany({
          where,
          include: jobInclude,
          orderBy: { startsAt: "asc" },
          skip: (page - 1) * JOBS_PAGE_SIZE,
          take: JOBS_PAGE_SIZE,
        }),
        prisma.jobPost.count({ where }),
      ]);

      const body: Paginated<PublicJobPost> = {
        items: rows.map(toPublicJobPost),
        total,
        page,
        pageSize: JOBS_PAGE_SIZE,
      };

      return reply.header("cache-control", LIST_CACHE).send(success(body));
    },
  );

  /**
   * Detalhe (§8). Vaga fechada, preenchida ou vencida responde 200 com o
   * status dela — nunca 404. É a página que o Google indexou; sumir com ela
   * joga fora a indexação já conquistada, e o visitante que chega pela busca
   * merece ver que a vaga existiu e acabou.
   */
  app.get<{ Params: { citySlug: string; slug: string } }>(
    "/v1/jobs/:citySlug/:slug",
    { onRequest: publicReadRateLimit },
    async (request, reply) => {
      const { citySlug, slug } = request.params;

      const job = await prisma.jobPost.findFirst({
        where: { slug, city: { slug: citySlug } },
        include: jobInclude,
      });

      if (!job) {
        return reply
          .status(404)
          .send(failure("job_not_found", "Vaga não encontrada."));
      }

      const body: ApiResult<PublicJobPost> = success(toPublicJobPost(job));
      return reply.header("cache-control", DETAIL_CACHE).send(body);
    },
  );

  /**
   * Publicação (§8). A empresa vem do TOKEN e de nenhum outro lugar: aceitar
   * `companyId` no corpo seria deixar qualquer conta publicar em nome de
   * qualquer empresa. A cidade também não vem do corpo — a vaga herda a
   * cidade da empresa, e texto digitado nunca vira cidade (§7.1).
   */
  app.post(
    "/v1/jobs",
    { preHandler: requireCompany },
    async (request, reply) => {
      // `requireCompany` já barrou quem não tem perfil de empresa; o
      // TypeScript não enxerga preHandler, então a checagem se repete de graça.
      const companyId = request.companyId;
      if (!companyId) {
        return reply
          .status(403)
          .send(
            failure("forbidden", "Esta área não está disponível nesta conta."),
          );
      }

      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, subscriptionStatus: true },
      });
      if (!company) {
        return reply
          .status(403)
          .send(
            failure("forbidden", "Esta área não está disponível nesta conta."),
          );
      }

      if (CANNOT_PUBLISH.has(company.subscriptionStatus)) {
        return reply
          .status(403)
          .send(
            failure(
              "subscription_inactive",
              "A assinatura está suspensa. Regularize para publicar vagas.",
            ),
          );
      }

      // O MESMO schema do formulário (§14.1): validação escrita de novo aqui
      // seria uma segunda versão da regra, e é a versão do cliente que se
      // contorna chamando a API direto.
      const parsed = jobPostSchema.safeParse(request.body);

      if (!parsed.success) {
        const body = (request.body ?? {}) as Record<string, unknown>;
        const asText = (value: unknown): string =>
          typeof value === "string" ? value : "";
        const matched = discriminatoryMatches(
          asText(body.title),
          asText(body.description),
          asText(body.requirements),
        );

        if (matched.length > 0) {
          // A tentativa bloqueada vira linha no banco: é prova de diligência,
          // e é o motivo de `blocked_job_attempts` existir. Sem os termos que
          // casaram, a prova só diz que algo foi barrado, não o quê.
          await prisma.blockedJobAttempt.create({
            data: {
              companyId: company.id,
              title: asText(body.title).slice(0, 160),
              description: asText(body.description),
              requirements: asText(body.requirements) || null,
              matchedTerms: matched,
              requestIp: request.ip,
            },
          });
          request.log.info(
            { companyId: company.id, matched },
            "vaga bloqueada por linguagem discriminatória",
          );
          return reply
            .status(400)
            .send(
              failure(
                "discriminatory_language",
                DISCRIMINATORY_MESSAGE,
                "title",
              ),
            );
        }

        const issue = parsed.error.issues[0];
        return reply
          .status(400)
          .send(
            failure(
              "validation_error",
              issue.message,
              issue.path.join(".") || undefined,
            ),
          );
      }

      const data = parsed.data;

      // A cidade é ESCOLHIDA, não herdada da empresa: é onde o trabalho
      // acontece, e é ela que decide quem é notificado (§16.2) e qual página
      // o Google indexa. Conferida contra a tabela porque o schema só sabe
      // que são sete dígitos — id bem-formado de município que não existe
      // viraria uma vaga que nenhuma listagem alcança.
      const city = await prisma.city.findUnique({
        where: { id: data.cityId },
        select: { id: true },
      });
      if (!city) {
        return reply
          .status(400)
          .send(
            failure(
              "city_not_found",
              "Selecione uma cidade da lista.",
              "cityId",
            ),
          );
      }

      // Fim menor que início é o bico que vira a noite — formatura entra 22h e
      // sai 2h —, e o schema já resolveu isso somando um dia. Inversão de
      // verdade quem recusa é o CHECK `job_posts_ends_after_start`, no banco.
      //
      // A vaga vence quando o turno COMEÇA: candidatar-se com o serviço já
      // rolando não serve para a empresa nem para quem se candidata.
      for (let attempt = 0; ; attempt += 1) {
        try {
          const job = await prisma.jobPost.create({
            data: {
              companyId: company.id,
              cityId: city.id,
              slug: await nextFreeSlug(city.id, data.title),
              role: data.role,
              title: data.title,
              description: data.description,
              startsAt: new Date(data.startsAt),
              endsAt: new Date(data.endsAt),
              payAmount: data.payAmount,
              payNote: data.payNote,
              address: data.address,
              neighborhood: data.neighborhood,
              requirements: data.requirements,
              providesTransport: data.providesTransport,
              reach: data.reach,
              reachRadiusKm: data.reachRadiusKm,
              vacancies: data.vacancies,
              applicationsCount: 0,
              expiresAt: new Date(data.startsAt),
            },
            include: jobInclude,
          });

          return reply.status(201).send(success(toPublicJobPost(job)));
        } catch (error) {
          // Duas publicações do mesmo título no mesmo instante disputam o slug
          // e uma perde no índice único. Recalcular e tentar de novo é mais
          // barato que segurar um lock; três voltas é folga de sobra.
          const isSlugRace =
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002" &&
            attempt < 3;
          if (!isSlugRace) throw error;
        }
      }
    },
  );

  /**
   * Fechar a vaga quando a empresa já se acertou com alguém (§8).
   *
   * A posse entra no WHERE, nunca num `if` depois da leitura: a atualização
   * só encontra linha se aquela vaga for da empresa do token. Vaga de outra
   * empresa responde 404 e não 403 — 403 confirmaria, para quem só chutou um
   * id, que aquela vaga existe.
   */
  app.patch<{ Params: { id: string } }>(
    "/v1/jobs/:id/close",
    { preHandler: requireCompany },
    async (request, reply) => {
      const companyId = request.companyId;
      if (!companyId) {
        return reply
          .status(403)
          .send(
            failure("forbidden", "Esta área não está disponível nesta conta."),
          );
      }

      const notFound = () =>
        reply.status(404).send(failure("not_found", "Vaga não encontrada."));

      // Um UUID malformado nunca chega ao banco como comparação de tipo.
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          request.params.id,
        )
      ) {
        return notFound();
      }

      const closed = await prisma.jobPost.updateMany({
        where: { id: request.params.id, companyId, status: "open" },
        data: { status: "filled" },
      });

      if (closed.count !== 1) {
        // Segunda consulta, e a posse continua no WHERE: serve só para separar
        // "já estava fechada" de "não é sua", sem contar nada a quem chutou.
        const mine = await prisma.jobPost.findFirst({
          where: { id: request.params.id, companyId },
          select: { id: true },
        });
        if (!mine) return notFound();
        return reply
          .status(409)
          .send(failure("job_not_open", "Esta vaga já está fechada."));
      }

      const job = await prisma.jobPost.findUniqueOrThrow({
        where: { id: request.params.id },
        include: jobInclude,
      });
      return reply.send(success(toPublicJobPost(job)));
    },
  );

  /**
   * Quantos trabalhadores seriam avisados de uma vaga com aquele alcance — o
   * "só Poços: 34 garçons; até 50 km: 121" que a tela de publicar mostra ANTES
   * de a empresa estreitar (§16.2). Sem esse número a decisão é tomada no
   * escuro e o prejuízo fica invisível para os dois lados.
   *
   * Responde pela MESMA query que decide o push (`countRoutedWorkers`), e é o
   * ponto inteiro da rota: se a conta que a tela mostra não for a que dispara,
   * a empresa estreita o alcance olhando um número que o push não honra — a
   * tela mente.
   *
   * É GET com querystring porque a tela chama a cada mudança de alcance, e o
   * que se pergunta é sobre uma vaga que ainda não existe.
   */
  app.get(
    "/v1/jobs/reach-count",
    { preHandler: requireCompany },
    async (request, reply) => {
      const parsed = jobReachCountQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return reply
          .status(400)
          .send(
            failure(
              "validation_error",
              issue.message,
              issue.path.join(".") || undefined,
            ),
          );
      }

      const count = await countRoutedWorkers(parsed.data);
      return reply.send(success({ count }));
    },
  );
}
