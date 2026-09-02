import { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyReply } from "fastify";
import { workerNotificationPreferencesSchema } from "@extra/shared/schemas/city";
import {
  workerCreateSchema,
  workerProfileUpdateSchema,
} from "@extra/shared/schemas/worker";
import type { Worker } from "@extra/shared/types/worker";
import { prisma } from "../db.js";
import { failure, success } from "../http.js";
import { requireAccount, requireWorker } from "../auth/session.js";

/**
 * O cadastro do trabalhador (§7.3, §16.1).
 *
 * Upload não está aqui: selfie e vídeo vão junto com o MinIO, na tarefa 25.
 * Quem chega sem os dois conclui o cadastro do mesmo jeito e recebe vaga
 * igual — o vídeo é o que dá o SELO, não o que dá acesso (§16.1).
 */

const forbidden = (reply: FastifyReply): FastifyReply =>
  reply
    .status(403)
    .send(failure("forbidden", "Esta área não está disponível nesta conta."));

/**
 * `fullName` vira dois campos: o perfil público mostra o primeiro nome mais a
 * inicial do sobrenome, e quebrar a string na leitura erra em "Maria de
 * Souza". O corte é no primeiro espaço — o resto inteiro é sobrenome, para
 * `firstName + " " + lastName` devolver o nome de origem sem perder o meio.
 */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") || firstName };
}

const workerInclude = {
  roles: { select: { role: true } },
  availability: { select: { weekday: true, period: true } },
  notificationCities: { select: { cityId: true } },
} as const;

type WorkerRow = Prisma.WorkerGetPayload<{ include: typeof workerInclude }>;

/**
 * O perfil do PRÓPRIO dono, servido só para ele. Carrega cpf e birthDate de
 * propósito — é a tela do próprio cadastro. Nenhuma rota que a empresa consome
 * passa por aqui: aquelas leem a view `worker_public_profiles` (§16.5).
 */
const toWorker = (row: WorkerRow, phone: string): Worker => ({
  id: row.id,
  fullName: `${row.firstName} ${row.lastName}`.trim(),
  phone,
  phoneVerifiedAt: null,
  cpf: row.cpf,
  birthDate: row.birthDate.toISOString().slice(0, 10),
  cityId: row.cityId,
  neighborhood: row.neighborhood,
  notificationCityIds: row.notificationCities.map((item) => item.cityId),
  nearbyRadiusKm: row.nearbyRadiusKm as Worker["nearbyRadiusKm"],
  roles: row.roles.map((item) => item.role),
  experience: row.experience,
  availability: row.availability.map((item) => ({
    weekday: item.weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    period: item.period,
  })),
  documentSelfieKey: row.documentSelfieKey,
  introVideoKey: row.introVideoKey,
  status: row.status,
  termsVersion: row.termsVersion,
  termsAcceptedAt: row.termsAcceptedAt.toISOString(),
  termsAcceptedIp: row.termsAcceptedIp,
  profileCompletedAt: row.profileCompletedAt?.toISOString() ?? null,
  // Agregado da view pública; o cadastro recém-criado nasce sem histórico, e
  // quem não tem histórico exibe "Novo por aqui", nunca "0 presenças" (§16.6).
  attendance: {
    present: 0,
    absent: 0,
    distinctCompanies: 0,
    hasHistory: false,
  },
  createdAt: row.createdAt.toISOString(),
});

async function loadWorker(
  workerId: string,
  phone: string,
): Promise<Worker | null> {
  const row = await prisma.worker.findUnique({
    where: { id: workerId },
    include: workerInclude,
  });
  return row ? toWorker(row, phone) : null;
}

export function registerWorkerRoutes(app: FastifyInstance): void {
  /**
   * Cria o perfil para a CONTA do token. Uma conta tem no máximo um worker —
   * garantido pelo `@unique` em `account_id`, não por uma leitura antes.
   */
  app.post(
    "/v1/workers",
    { preHandler: requireAccount },
    async (request, reply) => {
      const account = request.account;
      if (!account) return forbidden(reply);

      const parsed = workerCreateSchema.safeParse(request.body);
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
      const data = parsed.data;

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

      // As cidades de aviso também vêm da tabela: id bem-formado que não
      // existe viraria assinatura para uma cidade que nunca publica vaga.
      const known = await prisma.city.count({
        where: { id: { in: data.notificationCityIds } },
      });
      if (known !== data.notificationCityIds.length) {
        return reply
          .status(400)
          .send(
            failure(
              "city_not_found",
              "Escolha as cidades de aviso na lista.",
              "notificationCityIds",
            ),
          );
      }

      try {
        const created = await prisma.worker.create({
          data: {
            accountId: account.id,
            ...splitName(data.fullName),
            cpf: data.cpf,
            birthDate: new Date(`${data.birthDate}T00:00:00Z`),
            cityId: city.id,
            neighborhood: data.neighborhood,
            nearbyRadiusKm: data.nearbyRadiusKm,
            experience: data.experience,
            status: "incomplete",
            termsVersion: data.termsVersion,
            // Data e IP são do SERVIDOR: o cliente não sabe o próprio IP e não
            // deveria escolher a hora do consentimento (§7.3).
            termsAcceptedAt: new Date(),
            termsAcceptedIp: request.ip,
            roles: { create: data.roles.map((role) => ({ role })) },
            availability: { create: data.availability },
            notificationCities: {
              create: data.notificationCityIds.map((cityId) => ({ cityId })),
            },
          },
          include: workerInclude,
        });

        return reply
          .status(201)
          .send(success(toWorker(created, account.phone)));
      } catch (error) {
        const target =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          Array.isArray(error.meta?.target)
            ? (error.meta.target as string[])
            : [];

        if (target.includes("account_id")) {
          return reply
            .status(409)
            .send(
              failure(
                "worker_already_exists",
                "Esta conta já tem um cadastro de trabalhador.",
              ),
            );
        }

        /**
         * CPF duplicado sai GENÉRICO, e essa é a decisão inteira: um erro que
         * diz "este CPF já tem cadastro" transforma a rota num oráculo — dá
         * para varrer CPFs e descobrir quem está na plataforma, sem conta e
         * sem custo. O detalhe vai para o log, onde dá para investigar, e
         * nunca para o corpo.
         *
         * O log guarda o id da conta e o fato, jamais o CPF: `cpf` está na
         * lista de campos redigidos do servidor justamente porque log vaza
         * igual banco.
         */
        if (target.includes("cpf")) {
          request.log.warn(
            { accountId: account.id, reason: "cpf_conflict" },
            "cadastro recusado por conflito de identidade",
          );
          return reply
            .status(400)
            .send(
              failure(
                "registration_failed",
                "Não foi possível concluir o cadastro. Confira os dados e tente de novo.",
              ),
            );
        }

        throw error;
      }
    },
  );

  /** O próprio perfil, pelo token e por mais nada. */
  app.get(
    "/v1/workers/me",
    { preHandler: requireWorker },
    async (request, reply) => {
      if (!request.workerId || !request.account) return forbidden(reply);

      const worker = await loadWorker(request.workerId, request.account.phone);
      if (!worker) return forbidden(reply);
      return reply.send(success(worker));
    },
  );

  /**
   * Atualização parcial do próprio cadastro. O id nunca vem da URL nem do
   * corpo: vem do token, e por isso não existe rota para editar o de outro.
   */
  app.patch(
    "/v1/workers/me",
    { preHandler: requireWorker },
    async (request, reply) => {
      const workerId = request.workerId;
      if (!workerId || !request.account) return forbidden(reply);

      const parsed = workerProfileUpdateSchema.safeParse(request.body);
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
      const data = parsed.data;

      await prisma.$transaction(async (tx) => {
        await tx.worker.update({
          where: { id: workerId },
          data: {
            neighborhood: data.neighborhood,
            experience: data.experience,
            documentSelfieKey: data.documentSelfieKey,
            introVideoKey: data.introVideoKey,
            nearbyRadiusKm: data.nearbyRadiusKm,
          },
        });

        // Filhos são substituídos por inteiro quando vêm: o PATCH é parcial no
        // nível do CAMPO, e "minhas funções" é um campo só que por acaso mora
        // em outra tabela. Mesclar item a item deixaria o cliente sem forma de
        // REMOVER uma função.
        if (data.roles) {
          await tx.workerRole.deleteMany({ where: { workerId } });
          await tx.workerRole.createMany({
            data: data.roles.map((role) => ({ workerId, role })),
          });
        }

        if (data.availability) {
          await tx.workerAvailability.deleteMany({ where: { workerId } });
          await tx.workerAvailability.createMany({
            data: data.availability.map((slot) => ({ workerId, ...slot })),
          });
        }
      });

      const worker = await loadWorker(workerId, request.account.phone);
      if (!worker) return forbidden(reply);
      return reply.send(success(worker));
    },
  );

  /**
   * As cidades de aviso e o raio (§16.2). Rota própria porque é a preferência
   * que governa o push, e o push é o recurso mais escasso do produto: 1 a 5
   * cidades, raio 25, 50 ou desligado — tudo travado no schema compartilhado.
   */
  app.patch(
    "/v1/workers/me/notifications",
    { preHandler: requireWorker },
    async (request, reply) => {
      const workerId = request.workerId;
      if (!workerId || !request.account) return forbidden(reply);

      const parsed = workerNotificationPreferencesSchema.safeParse(
        request.body,
      );
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
      const { notificationCityIds, nearbyRadiusKm } = parsed.data;

      const known = await prisma.city.count({
        where: { id: { in: notificationCityIds } },
      });
      if (known !== notificationCityIds.length) {
        return reply
          .status(400)
          .send(
            failure(
              "city_not_found",
              "Escolha as cidades de aviso na lista.",
              "notificationCityIds",
            ),
          );
      }

      await prisma.$transaction(async (tx) => {
        await tx.workerNotificationCity.deleteMany({ where: { workerId } });
        await tx.workerNotificationCity.createMany({
          data: notificationCityIds.map((cityId) => ({ workerId, cityId })),
        });
        await tx.worker.update({
          where: { id: workerId },
          data: { nearbyRadiusKm },
        });
      });

      const worker = await loadWorker(workerId, request.account.phone);
      if (!worker) return forbidden(reply);
      return reply.send(success(worker));
    },
  );
}
