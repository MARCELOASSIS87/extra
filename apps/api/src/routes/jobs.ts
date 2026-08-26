import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import {
  JOBS_PAGE_SIZE,
  publicJobsQuerySchema,
} from "@extra/shared/schemas/job";
import type { ApiResult, Paginated } from "@extra/shared/types/api";
import type { PublicJobPost } from "@extra/shared/types/job";
import { maxApplicationsFor } from "@extra/shared/lib/job";
import { prisma } from "../db.js";
import { failure, success } from "../http.js";
import { publicReadRateLimit } from "../rate-limit.js";

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
const jobInclude = {
  company: { select: { tradeName: true } },
  city: { select: { name: true, slug: true } },
} as const;

type JobRow = Prisma.JobPostGetPayload<{ include: typeof jobInclude }>;

const toPublicJobPost = (job: JobRow): PublicJobPost => ({
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
}
