import type { FastifyInstance, FastifyReply } from "fastify";
import {
  AUTO_NOT_SELECTED_DAYS,
  DISPUTE_WINDOW_DAYS,
  effectiveAttendanceStatus,
  isUnderDispute,
} from "@extra/shared/lib/attendance";
import { attendanceMarkSchema } from "@extra/shared/schemas/attendance";
import type {
  AttendancePendingItem,
  AttendanceRecord,
} from "@extra/shared/types/attendance";
import { prisma } from "../db.js";
import { failure, success } from "../http.js";
import { requireCompany, requireWorker } from "../auth/session.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DAY_MS = 24 * 60 * 60 * 1000;

const notFound = (reply: FastifyReply, message: string): FastifyReply =>
  reply.status(404).send(failure("not_found", message));

type RecordRow = {
  id: string;
  status: AttendanceRecord["status"];
  markedAt: Date | null;
  disputedAt: Date | null;
  disputeResolvedAt: Date | null;
  disputeOutcome: AttendanceRecord["disputeOutcome"];
};

/**
 * `workerId`, `companyId` e `jobPostId` são DERIVADOS: a tabela guarda só
 * `applicationId`, e os três chegam pelo join que serviu a leitura. Eram
 * colunas de verdade e deixaram de ser — cópia do que a candidatura já diz
 * envelhece (§7.4).
 */
const toRecord = (
  row: RecordRow,
  ids: { workerId: string; companyId: string; jobPostId: string },
): AttendanceRecord => ({
  id: row.id,
  workerId: ids.workerId,
  companyId: ids.companyId,
  jobPostId: ids.jobPostId,
  status: row.status,
  markedAt: row.markedAt?.toISOString() ?? null,
  disputedAt: row.disputedAt?.toISOString() ?? null,
  disputeResolvedAt: row.disputeResolvedAt?.toISOString() ?? null,
  disputeOutcome: row.disputeOutcome,
});

/**
 * Teto da página. A fila não pode crescer sem limite: uma empresa com meses de
 * evento acumulado carregaria centenas de itens num celular em 4G, e ninguém
 * marca presença de trezentos de uma vez.
 */
const PENDING_PAGE_SIZE = 50;

export function registerAttendanceRoutes(app: FastifyInstance): void {
  /**
   * A empresa marca o desfecho (§16.4, §16.7). Um clique por candidato, entre
   * três opções, e NENHUM texto — ver o `.strict()` do schema.
   */
  app.post<{ Params: { id: string } }>(
    "/v1/jobs/:id/attendance",
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

      const parsed = attendanceMarkSchema.safeParse(request.body);
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

      // A posse da vaga entra no WHERE, junto da candidatura: uma consulta só
      // prova que aquela candidatura é de uma vaga desta empresa. Vaga de
      // outra empresa não é encontrada, e 404 não confirma que o id existe.
      const application = await prisma.application.findFirst({
        where: {
          id: parsed.data.applicationId,
          jobPostId: request.params.id,
          jobPost: { companyId },
        },
        select: {
          id: true,
          workerId: true,
          jobPostId: true,
          jobPost: { select: { endsAt: true, companyId: true } },
          attendance: true,
        },
      });
      if (!application?.workerId) {
        return notFound(reply, "Candidatura não encontrada nesta vaga.");
      }

      // Antes do fim do turno não há o que marcar: a pessoa ainda pode chegar.
      if (application.jobPost.endsAt.getTime() > Date.now()) {
        return reply
          .status(409)
          .send(
            failure(
              "job_not_finished",
              "A marcação abre depois do fim do trabalho.",
            ),
          );
      }

      const existing = application.attendance;

      // Contestação em aberto congela a marcação (regra 11): o `status` guarda
      // o que a empresa marcou, e remarcar por cima apagaria justamente o que
      // está sendo contestado.
      if (
        existing &&
        isUnderDispute(
          toRecord(existing, {
            workerId: application.workerId,
            companyId: application.jobPost.companyId,
            jobPostId: application.jobPostId,
          }),
        )
      ) {
        return reply
          .status(409)
          .send(
            failure(
              "attendance_under_dispute",
              "Esta marcação está em contestação e não pode ser alterada.",
            ),
          );
      }

      // Remarcar é permitido fora de contestação: a empresa erra o clique.
      const saved = await prisma.attendanceRecord.upsert({
        where: { applicationId: application.id },
        create: {
          applicationId: application.id,
          status: parsed.data.status,
          markedAt: new Date(),
        },
        update: { status: parsed.data.status, markedAt: new Date() },
      });

      return reply.send(
        success(
          toRecord(saved, {
            workerId: application.workerId,
            companyId: application.jobPost.companyId,
            jobPostId: application.jobPostId,
          }),
        ),
      );
    },
  );

  /**
   * O trabalhador contesta (§16.4). Contestar NÃO apaga a marcação: `status`
   * continua sendo o que a empresa marcou, e a contestação vive nas suas
   * próprias colunas (regra 11). O que ela faz é tirar o registro da contagem
   * pública até alguém resolver — e quem faz isso é a view.
   */
  app.post<{ Params: { id: string } }>(
    "/v1/attendance/:id/dispute",
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
        return notFound(reply, "Marcação não encontrada.");
      }

      // A posse chega pela candidatura, no WHERE: registro de outro
      // trabalhador simplesmente não é encontrado.
      const record = await prisma.attendanceRecord.findFirst({
        where: { id: request.params.id, application: { workerId } },
        select: {
          id: true,
          status: true,
          markedAt: true,
          disputedAt: true,
          disputeResolvedAt: true,
          disputeOutcome: true,
          application: {
            select: {
              workerId: true,
              jobPostId: true,
              jobPost: { select: { companyId: true } },
            },
          },
        },
      });
      if (!record?.application.workerId) {
        return notFound(reply, "Marcação não encontrada.");
      }

      const ids = {
        workerId: record.application.workerId,
        companyId: record.application.jobPost.companyId,
        jobPostId: record.application.jobPostId,
      };

      // Só cabe contra o que entra no histórico público. `not_selected` é
      // neutro e `pending` é ausência de marcação — não há o que contestar.
      if (record.status !== "present" && record.status !== "absent") {
        return reply
          .status(409)
          .send(
            failure(
              "attendance_not_disputable",
              "Esta marcação não entra no seu histórico e não precisa ser contestada.",
            ),
          );
      }

      if (record.disputedAt) {
        return reply
          .status(409)
          .send(
            failure("already_disputed", "Esta marcação já foi contestada."),
          );
      }

      // Sete dias contados da marcação. `markedAt` nunca é nulo aqui: o CHECK
      // `attendance_pending_iff_unmarked` garante que só `pending` é nulo.
      const markedAt = record.markedAt?.getTime() ?? 0;
      if (Date.now() > markedAt + DISPUTE_WINDOW_DAYS * DAY_MS) {
        return reply
          .status(409)
          .send(
            failure(
              "dispute_window_closed",
              `O prazo de ${DISPUTE_WINDOW_DAYS} dias para contestar já passou.`,
            ),
          );
      }

      // `disputedAt: null` no WHERE fecha a corrida de dois cliques: o
      // segundo não encontra linha e não sobrescreve a data do primeiro.
      const opened = await prisma.attendanceRecord.updateMany({
        where: { id: record.id, disputedAt: null },
        data: { disputedAt: new Date() },
      });
      if (opened.count !== 1) {
        return reply
          .status(409)
          .send(
            failure("already_disputed", "Esta marcação já foi contestada."),
          );
      }

      const updated = await prisma.attendanceRecord.findUniqueOrThrow({
        where: { id: record.id },
      });
      return reply.send(success(toRecord(updated, ids)));
    },
  );

  /**
   * A fila de marcação da empresa (§16.4): quem trabalhou e ainda não foi
   * marcado. É o que abre o painel depois do evento.
   *
   * A posse entra no WHERE — `jobPost: { companyId }` —, então vaga de outra
   * empresa não é encontrada, e não existe `if` depois da consulta para
   * esquecer num refactor.
   *
   * O corte dos 7 dias entra no WHERE como INSTANTE calculado em JS a partir
   * de `AUTO_NOT_SELECTED_DAYS` — nunca como literal no SQL. A constante
   * continua morando só no shared: aqui ela é lida, não repetida.
   *
   * Quem DECIDE o que aparece continua sendo `effectiveAttendanceStatus`, na
   * leitura; o WHERE só evita trazer do banco o que já não poderia aparecer
   * (§16.7). Com a janela na consulta, `take`/`skip` voltam para o banco e a
   * fila deixa de ler linha que seria descartada em memória.
   */
  app.get<{ Querystring: { page?: string } }>(
    "/v1/companies/me/attendance/pending",
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

      const page = Math.max(1, Number(request.query.page) || 1);
      const now = new Date();

      // O instante em que uma vaga que terminou passa a ser `not_selected`
      // sozinha. Espelha a soma da função compartilhada — `setUTCDate`, e não
      // `now - 7 * dia`, para os dois cortes coincidirem na borda.
      const cutoff = new Date(now);
      cutoff.setUTCDate(cutoff.getUTCDate() - AUTO_NOT_SELECTED_DAYS);

      // Uma consulta, com os dois joins. O perfil vem da tabela porque aqui só
      // saem primeiro nome e inicial — nunca o nome completo, nunca a conta.
      const rows = await prisma.application.findMany({
        where: {
          status: { not: "withdrawn" },
          workerId: { not: null },
          jobPost: { companyId, endsAt: { lt: now, gte: cutoff } },
          // Já marcado sai da fila. `pending` gravado CONTINUA na fila: é a
          // ausência de marcação, não uma marcação (§16.7).
          OR: [{ attendance: null }, { attendance: { status: "pending" } }],
        },
        orderBy: { jobPost: { endsAt: "desc" } },
        select: {
          id: true,
          shortCode: true,
          attendance: { select: { status: true, markedAt: true } },
          worker: { select: { id: true, firstName: true, lastName: true } },
          jobPost: {
            select: {
              id: true,
              title: true,
              role: true,
              neighborhood: true,
              startsAt: true,
              endsAt: true,
            },
          },
        },
        skip: (page - 1) * PENDING_PAGE_SIZE,
        take: PENDING_PAGE_SIZE,
      });

      const nowIso = now.toISOString();
      const items: AttendancePendingItem[] = rows
        .filter(
          (row) =>
            effectiveAttendanceStatus(
              {
                status: row.attendance?.status ?? "pending",
                markedAt: row.attendance?.markedAt?.toISOString() ?? null,
              },
              row.jobPost.endsAt.toISOString(),
              nowIso,
            ) === "pending",
        )
        .flatMap((row) => {
          if (!row.worker) return [];
          return [
            {
              applicationId: row.id,
              shortCode: row.shortCode.trim(),
              workerId: row.worker.id,
              workerFirstName: row.worker.firstName,
              // A inicial do SOBRENOME, mesma regra da view pública: o campo
              // guarda o resto inteiro do nome, e a última palavra é o
              // sobrenome de verdade.
              workerLastNameInitial: lastNameInitial(row.worker.lastName),
              jobPostId: row.jobPost.id,
              jobTitle: row.jobPost.title,
              jobRole: row.jobPost.role,
              jobNeighborhood: row.jobPost.neighborhood,
              jobStartsAt: row.jobPost.startsAt.toISOString(),
              jobEndsAt: row.jobPost.endsAt.toISOString(),
            },
          ];
        });

      return reply.send(success(items));
    },
  );
}

/**
 * Primeiro caractere da ÚLTIMA palavra, descartando sufixo de geração — a
 * mesma regra da view `worker_public_profiles`. Duplicada aqui porque a fila
 * não passa pela view: é leitura da empresa dona da vaga, e a view existe para
 * o perfil público. Se uma terceira leitura precisar disto, vira função no
 * shared.
 */
const GENERATION_SUFFIX =
  /(^|\s+)(jr|j[uú]nior|neto|filho|sobrinho|segundo)\.?\s*$/i;

function lastNameInitial(lastName: string): string {
  let base = lastName.trim();
  while (GENERATION_SUFFIX.test(base))
    base = base.replace(GENERATION_SUFFIX, "");
  const word = base.split(/\s+/).at(-1) ?? "";
  return word ? `${word.charAt(0)}.` : "";
}
