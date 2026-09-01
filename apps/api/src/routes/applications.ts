import { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyReply } from "fastify";
import { randomShortCode } from "@extra/shared/lib/application";
import { effectiveAttendanceStatus } from "@extra/shared/lib/attendance";
import type {
  Application,
  ApplicationContact,
  JobApplicant,
  MyApplication,
} from "@extra/shared/types/application";
import type { AttendanceSummary } from "@extra/shared/types/attendance";
import type { WorkerPublicProfile } from "@extra/shared/types/worker";
import type { JobRole } from "@extra/shared/types/job";
import { prisma } from "../db.js";
import { failure, success } from "../http.js";
import { requireCompany, requireWorker } from "../auth/session.js";
import { jobInclude, toPublicJobPost } from "./jobs.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = (reply: FastifyReply, message: string): FastifyReply =>
  reply.status(404).send(failure("not_found", message));

type ApplicationRow = {
  id: string;
  jobPostId: string;
  workerId: string | null;
  shortCode: string;
  status: Application["status"];
  appliedAt: Date;
  contactedAt: Date | null;
  confirmedAt: Date | null;
};

const toApplication = (row: ApplicationRow): Application => ({
  id: row.id,
  shortCode: row.shortCode.trim(), // char(4): o Postgres devolve com padding
  jobPostId: row.jobPostId,
  // Nulo só depois de exclusão de conta, que anonimiza em vez de destruir a
  // história operacional da empresa (§13.1).
  workerId: row.workerId ?? "",
  status: row.status,
  appliedAt: row.appliedAt.toISOString(),
  contactedAt: row.contactedAt?.toISOString() ?? null,
  confirmedAt: row.confirmedAt?.toISOString() ?? null,
});

/** P2002 naquele índice, e não em outro: duplicata de código pede outro
 * código, duplicata de candidatura é o 409 que o cliente tem que ver. */
const isUniqueViolationOn = (error: unknown, field: string): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002" &&
  Array.isArray(error.meta?.target) &&
  (error.meta.target as string[]).includes(field);

/**
 * O CHECK `job_posts_applications_within_cap` estourou: o teto do §16.5.
 *
 * Reconhecido pelo NOME da constraint dentro da mensagem, e não pelo código
 * do Prisma, porque ele embrulha o mesmo 23514 do Postgres em duas classes
 * diferentes conforme a chamada — `P2010` na consulta crua, e um
 * `PrismaClientUnknownRequestError` sem código no `update()` tipado. O nome
 * da constraint é a única parte estável dos dois.
 */
const isCapViolation = (error: unknown): boolean =>
  error instanceof Error &&
  error.message.includes("job_posts_applications_within_cap");

export function registerApplicationRoutes(app: FastifyInstance): void {
  /**
   * Candidatar-se (§8, §16.5). O trabalhador vem do TOKEN.
   *
   * O INSERT e o incremento acontecem na MESMA transação, e o teto NÃO é
   * conferido em código antes: quem recusa é o CHECK sobre
   * `applications_count`, avaliado no UPDATE. Ler o contador e decidir no
   * TypeScript perde a corrida — dois pedidos na última vaga leem o mesmo
   * número e os dois passam. Aqui o segundo UPDATE espera o primeiro
   * confirmar, reavalia sobre o valor novo e vira 409.
   *
   * Perfil incompleto NÃO impede: a plataforma não trava ninguém.
   */
  app.post<{ Params: { id: string } }>(
    "/v1/jobs/:id/applications",
    { preHandler: requireWorker },
    async (request, reply) => {
      const workerId = request.workerId;
      if (!workerId) {
        return reply
          .status(403)
          .send(
            failure("forbidden", "Esta área não está disponível nesta conta."),
          );
      }
      if (!UUID.test(request.params.id)) {
        return notFound(reply, "Vaga não encontrada.");
      }

      const jobPostId = request.params.id;

      for (let attempt = 0; ; attempt += 1) {
        try {
          const created = await prisma.$transaction(async (tx) => {
            const job = await tx.jobPost.findUnique({
              where: { id: jobPostId },
              select: { id: true, status: true, expiresAt: true },
            });
            if (!job) return null;

            // Fechada, preenchida, cancelada ou já vencida: não recebe mais.
            if (
              job.status !== "open" ||
              job.expiresAt.getTime() <= Date.now()
            ) {
              throw new JobClosed();
            }

            const application = await tx.application.create({
              data: {
                jobPostId,
                workerId,
                shortCode: randomShortCode(),
              },
            });

            // Mesmo transação, sem leitura antes: o CHECK decide.
            await tx.jobPost.update({
              where: { id: jobPostId },
              data: { applicationsCount: { increment: 1 } },
            });

            return application;
          });

          if (!created) return notFound(reply, "Vaga não encontrada.");
          return reply.status(201).send(success(toApplication(created)));
        } catch (error) {
          if (error instanceof JobClosed) {
            return reply
              .status(409)
              .send(
                failure(
                  "job_not_open",
                  "Esta vaga não está mais recebendo candidaturas.",
                ),
              );
          }
          if (isCapViolation(error)) {
            return reply
              .status(409)
              .send(
                failure(
                  "applications_full",
                  "Esta vaga já tem candidatos suficientes.",
                ),
              );
          }
          if (isUniqueViolationOn(error, "worker_id")) {
            return reply
              .status(409)
              .send(
                failure(
                  "already_applied",
                  "Você já se candidatou a esta vaga.",
                ),
              );
          }
          // Só a colisão de código se resolve tentando de novo. O alfabeto tem
          // 32^4 combinações e o índice é por vaga, então três voltas sobram.
          if (isUniqueViolationOn(error, "short_code") && attempt < 3) continue;
          throw error;
        }
      }
    },
  );

  /** As candidaturas do trabalhador do token, mais recentes primeiro. */
  app.get(
    "/v1/me/applications",
    { preHandler: requireWorker },
    async (request, reply) => {
      const workerId = request.workerId;
      if (!workerId) {
        return reply
          .status(403)
          .send(
            failure("forbidden", "Esta área não está disponível nesta conta."),
          );
      }

      // A vaga vem no mesmo join: uma chamada por candidatura seria N+1 no
      // celular de quem está em 4G com dados contados.
      const rows = await prisma.application.findMany({
        where: { workerId },
        orderBy: { appliedAt: "desc" },
        include: { jobPost: { include: jobInclude }, attendance: true },
      });

      const now = new Date().toISOString();
      const body: MyApplication[] = rows.map(
        ({ jobPost, attendance, ...application }) => ({
          application: toApplication(application),
          job: toPublicJobPost(jobPost),
          // O desfecho já derivado: `not_selected` passados 7 dias do fim do
          // trabalho, nunca falta. Quem decide é a função compartilhada, para
          // a tela não comparar data nem concluir nada de um silêncio (§16.7).
          attendanceStatus:
            jobPost.endsAt.toISOString() > now
              ? null
              : effectiveAttendanceStatus(
                  {
                    status: attendance?.status ?? "pending",
                    markedAt: attendance?.markedAt?.toISOString() ?? null,
                  },
                  jobPost.endsAt.toISOString(),
                  now,
                ),
        }),
      );
      return reply.send(success(body));
    },
  );

  /**
   * Confirmação de véspera (§16.3). A posse entra no WHERE: candidatura de
   * outro trabalhador não é encontrada, e responde 404.
   */
  app.post<{ Params: { id: string } }>(
    "/v1/applications/:id/confirm",
    { preHandler: requireWorker },
    async (request, reply) => {
      const workerId = request.workerId;
      if (!workerId) {
        return reply
          .status(403)
          .send(
            failure("forbidden", "Esta área não está disponível nesta conta."),
          );
      }
      if (!UUID.test(request.params.id)) {
        return notFound(reply, "Candidatura não encontrada.");
      }

      // `confirmedAt: null` no WHERE deixa a rota idempotente sem um `if`
      // depois da leitura: confirmar duas vezes não reescreve a primeira data.
      await prisma.application.updateMany({
        where: { id: request.params.id, workerId, confirmedAt: null },
        data: { confirmedAt: new Date(), status: "confirmed" },
      });

      const application = await prisma.application.findFirst({
        where: { id: request.params.id, workerId },
      });
      if (!application) return notFound(reply, "Candidatura não encontrada.");

      return reply.send(success(toApplication(application)));
    },
  );

  /**
   * Os candidatos de uma vaga da empresa (§8).
   *
   * O perfil sai da VIEW `worker_public_profiles`, nunca da tabela `workers`:
   * a view não seleciona cpf nem birth_date e não alcança `accounts`, então
   * não existe coluna de telefone para vazar. Não se protege com `select` o
   * que se pode simplesmente não conseguir ler.
   *
   * TODO: sem `presentWithCompany` e sem `attendanceStatus`, que a tela
   * do mock mostra. São mais dois agregados e nada nesta tarefa depende
   * deles; entram junto com a marcação de presença.
   */
  app.get<{ Params: { id: string } }>(
    "/v1/jobs/:id/applicants",
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
      if (!UUID.test(request.params.id)) {
        return notFound(reply, "Vaga não encontrada.");
      }

      // A posse da vaga entra no WHERE. Vaga de outra empresa não é
      // encontrada, e 404 não confirma que o id existe.
      const job = await prisma.jobPost.findFirst({
        where: { id: request.params.id, companyId },
        select: { id: true, cityId: true },
      });
      if (!job) return notFound(reply, "Vaga não encontrada.");

      const applications = await prisma.application.findMany({
        where: { jobPostId: job.id, status: { not: "withdrawn" } },
        orderBy: { appliedAt: "asc" },
      });

      const workerIds = applications
        .map((item) => item.workerId)
        .filter((id): id is string => id !== null);

      if (workerIds.length === 0) {
        return reply.send(success([] satisfies JobApplicant[]));
      }

      // Três leituras em lote, nenhuma dentro de laço: a view do perfil, a
      // view do histórico, as funções e a distância.
      const [profiles, summaries, roles, neighbors] = await Promise.all([
        prisma.$queryRaw<
          {
            id: string;
            first_name: string;
            last_name_initial: string;
            city_name: string;
            neighborhood: string;
            experience: string;
            intro_video_key: string | null;
            has_complete_profile: boolean;
            member_since: Date;
          }[]
        >`SELECT * FROM worker_public_profiles WHERE id = ANY(${workerIds}::uuid[])`,
        prisma.$queryRaw<
          {
            worker_id: string;
            present: bigint;
            absent: bigint;
            distinct_companies: bigint;
            has_history: boolean;
          }[]
        >`SELECT * FROM worker_attendance_summary WHERE worker_id = ANY(${workerIds}::uuid[])`,
        prisma.workerRole.findMany({
          where: { workerId: { in: workerIds } },
          select: { workerId: true, role: true },
        }),
        prisma.$queryRaw<{ worker_id: string; distance_km: number }[]>`
          SELECT w.id AS worker_id, cn.distance_km
            FROM workers w
            JOIN city_neighbors cn
              ON cn.city_id = w.city_id AND cn.neighbor_city_id = ${job.cityId}
           WHERE w.id = ANY(${workerIds}::uuid[])`,
      ]);

      const profileById = new Map(profiles.map((row) => [row.id, row]));
      const summaryById = new Map(summaries.map((row) => [row.worker_id, row]));
      const distanceById = new Map(
        neighbors.map((row) => [row.worker_id, row.distance_km]),
      );
      const rolesById = new Map<string, JobRole[]>();
      for (const { workerId, role } of roles) {
        rolesById.set(workerId, [...(rolesById.get(workerId) ?? []), role]);
      }

      const emptySummary: AttendanceSummary = {
        present: 0,
        absent: 0,
        distinctCompanies: 0,
        // O servidor é quem decide: a interface nunca interpreta um zero, e
        // quem não tem histórico exibe "Novo por aqui" (§16.6).
        hasHistory: false,
      };

      const body: JobApplicant[] = applications.flatMap((application) => {
        const profile = application.workerId
          ? profileById.get(application.workerId)
          : undefined;
        // Sem perfil na view: conta desativada. Some da lista em vez de
        // aparecer pela metade.
        if (!profile || !application.workerId) return [];

        const summary = summaryById.get(application.workerId);
        const worker: WorkerPublicProfile = {
          id: profile.id,
          firstName: profile.first_name,
          lastNameInitial: profile.last_name_initial,
          cityName: profile.city_name,
          neighborhood: profile.neighborhood,
          roles: rolesById.get(application.workerId) ?? [],
          experience: profile.experience,
          // TODO: a URL assinada do MinIO é a tarefa 25. Até lá, quem tem
          // vídeo aparece com o selo e sem player, em vez de com um link morto.
          introVideoUrl: null,
          introVideoPosterUrl: null,
          hasCompleteProfile: profile.has_complete_profile,
          attendance: summary
            ? {
                present: Number(summary.present),
                absent: Number(summary.absent),
                distinctCompanies: Number(summary.distinct_companies),
                hasHistory: summary.has_history,
              }
            : emptySummary,
          memberSince: profile.member_since.toISOString(),
        };

        return [
          {
            application: toApplication(application),
            worker,
            distanceKm: distanceById.get(application.workerId) ?? null,
          },
        ];
      });

      return reply.send(success(body));
    },
  );

  /**
   * A ÚNICA rota do sistema que revela um telefone (§16.5, regra 8).
   *
   * As duas consultas provam a posse no WHERE, na mesma ida ao banco em que
   * leem: a candidatura só é encontrada se pertencer a uma vaga da empresa do
   * token. Buscar por id e comparar `companyId` depois, num `if`, é a forma
   * de esquecer a comparação num refactor e transformar isto numa lista
   * telefônica.
   *
   * `contactedAt: null` no WHERE do UPDATE faz a primeira data ser definitiva:
   * chamar de novo devolve o mesmo telefone e a mesma data. O clique É o ato
   * de escolher, e reescrever a data apagaria quando a escolha aconteceu.
   */
  app.get<{ Params: { id: string } }>(
    "/v1/applications/:id/contact",
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
      if (!UUID.test(request.params.id)) {
        return notFound(reply, "Candidatura não encontrada.");
      }

      const owned = { id: request.params.id, jobPost: { companyId } };

      await prisma.application.updateMany({
        where: { ...owned, contactedAt: null },
        data: { contactedAt: new Date() },
      });

      const application = await prisma.application.findFirst({
        where: owned,
        select: {
          id: true,
          contactedAt: true,
          worker: { select: { account: { select: { phone: true } } } },
        },
      });

      // Candidatura de outra empresa responde igual a candidatura inexistente.
      // 403 confirmaria, para quem só chutou um id, que ela existe.
      if (!application?.worker || !application.contactedAt) {
        return notFound(reply, "Candidatura não encontrada.");
      }

      const body: ApplicationContact = {
        applicationId: application.id,
        phone: application.worker.account.phone,
        contactedAt: application.contactedAt.toISOString(),
      };
      return reply.send(success(body));
    },
  );
}

/** Vaga que não recebe mais candidatura. Desfaz a transação e vira 409. */
class JobClosed extends Error {}
