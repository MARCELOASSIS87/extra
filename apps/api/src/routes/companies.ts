import { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  companyProfileUpdateSchema,
  companyRegistrationSchema,
} from "@extra/shared/schemas/company";
import { reportCreateSchema } from "@extra/shared/schemas/report";
import { pushSubscriptionSchema } from "@extra/shared/schemas/push";
import type { Company } from "@extra/shared/types/company";
import type { NewApplicant } from "@extra/shared/types/application";
import type { PublicJobPost } from "@extra/shared/types/job";
import { prisma } from "../db.js";
import { loadWorkerProfiles } from "../worker-profiles.js";
import { jobInclude, toPublicJobPost } from "./jobs.js";
import { toApplication } from "./applications.js";
import { failure, success } from "../http.js";
import { reportRateLimit } from "../rate-limit.js";
import {
  requireAccount,
  requireCompany,
  requireWorker,
} from "../auth/session.js";

const forbidden = (reply: FastifyReply): FastifyReply =>
  reply
    .status(403)
    .send(failure("forbidden", "Esta área não está disponível nesta conta."));

const validationError = (
  reply: FastifyReply,
  issue: { message: string; path: PropertyKey[] },
): FastifyReply =>
  reply
    .status(400)
    .send(
      failure(
        "validation_error",
        issue.message,
        issue.path.join(".") || undefined,
      ),
    );

type CompanyRow = Prisma.CompanyGetPayload<object>;

const toCompany = (row: CompanyRow, phone: string): Company => ({
  id: row.id,
  cnpj: row.document,
  legalName: row.legalName,
  tradeName: row.tradeName,
  responsibleName: row.responsibleName,
  phone,
  email: row.email,
  cityId: row.cityId,
  subscriptionStatus: row.subscriptionStatus,
  subscriptionEndsAt: row.subscriptionEndsAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  // Aceite do termo: o registro vive na conta, e a data de criação é o
  // instante em que o aceite foi carimbado pelo servidor.
  termsAcceptedAt: row.createdAt.toISOString(),
});

export function registerCompanyRoutes(app: FastifyInstance): void {
  /**
   * Cria a empresa para a CONTA do token (§7.7). Uma conta, uma empresa —
   * garantido pelo `@unique` em `account_id`, não por uma leitura antes.
   */
  app.post(
    "/v1/companies",
    { preHandler: requireAccount },
    async (request, reply) => {
      const account = request.account;
      if (!account) return forbidden(reply);

      const parsed = companyRegistrationSchema.safeParse(request.body);
      if (!parsed.success) {
        return validationError(reply, parsed.error.issues[0]);
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

      try {
        const created = await prisma.company.create({
          data: {
            accountId: account.id,
            // No MVP é sempre CNPJ. A coluna já aceita `cpf` porque a v2.0
            // atende contratante pessoa física (§21) — renomear depois, com
            // empresas cadastradas, custaria migração de dado. Aceitar agora
            // seria abrir a v2.0 sem as regras dela.
            documentType: "cnpj",
            document: data.cnpj,
            legalName: data.legalName,
            tradeName: data.tradeName,
            responsibleName: data.responsibleName,
            email: data.email,
            cityId: city.id,
          },
        });

        return reply
          .status(201)
          .send(success(toCompany(created, account.phone)));
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
                "company_already_exists",
                "Esta conta já tem uma empresa cadastrada.",
              ),
            );
        }

        /**
         * Documento duplicado sai GENÉRICO, pelo mesmo motivo do CPF: uma
         * resposta que diz "este CNPJ já tem cadastro" transforma a rota num
         * verificador de quem está na plataforma. CNPJ é público, mas quem
         * contrata bico aqui não é — e a lista de clientes é do concorrente
         * que a pedir. Detalhe no log, nunca no corpo.
         */
        if (target.includes("document")) {
          request.log.warn(
            { accountId: account.id, reason: "document_conflict" },
            "cadastro de empresa recusado por conflito de identidade",
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

  /** A própria empresa, pelo token e por mais nada. */
  app.get(
    "/v1/companies/me",
    { preHandler: requireCompany },
    async (request, reply) => {
      if (!request.companyId || !request.account) return forbidden(reply);

      const company = await prisma.company.findUnique({
        where: { id: request.companyId },
      });
      if (!company) return forbidden(reply);
      return reply.send(success(toCompany(company, request.account.phone)));
    },
  );

  /** Atualização parcial. O documento não entra — ver o schema. */
  app.patch(
    "/v1/companies/me",
    { preHandler: requireCompany },
    async (request, reply) => {
      const companyId = request.companyId;
      if (!companyId || !request.account) return forbidden(reply);

      const parsed = companyProfileUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return validationError(reply, parsed.error.issues[0]);
      }
      const data = parsed.data;

      if (data.cityId) {
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
      }

      const updated = await prisma.company.update({
        where: { id: companyId },
        data: {
          legalName: data.legalName,
          tradeName: data.tradeName,
          responsibleName: data.responsibleName,
          email: data.email,
          cityId: data.cityId,
        },
      });

      return reply.send(success(toCompany(updated, request.account.phone)));
    },
  );

  /**
   * Denúncia de vaga ou de perfil (§14.4).
   *
   * Anônima é permitida de propósito: exigir conta para denunciar filtra
   * justamente quem tem mais motivo para não se expor. O que fica registrado
   * é o IP — o bastante para investigar abuso sem transformar a denúncia numa
   * assinatura.
   *
   * Teto de IP próprio e apertado: denúncia é porta de abuso nos dois
   * sentidos, para derrubar anúncio legítimo e para afogar a moderação.
   */
  app.post(
    "/v1/reports",
    { onRequest: reportRateLimit },
    async (request, reply) => {
      const parsed = reportCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return validationError(reply, parsed.error.issues[0]);
      }
      const data = parsed.data;

      // O alvo é conferido contra a tabela: id que não existe viraria denúncia
      // órfã, que a moderação abre e não encontra nada para julgar.
      if (data.targetJobPostId) {
        const job = await prisma.jobPost.findUnique({
          where: { id: data.targetJobPostId },
          select: { id: true },
        });
        if (!job) {
          return reply
            .status(404)
            .send(failure("not_found", "Vaga não encontrada."));
        }
      } else if (data.targetWorkerId) {
        const worker = await prisma.worker.findUnique({
          where: { id: data.targetWorkerId },
          select: { id: true },
        });
        if (!worker) {
          return reply
            .status(404)
            .send(failure("not_found", "Perfil não encontrado."));
        }
      }

      const report = await prisma.report.create({
        data: {
          // Nulo quando anônima. A conta entra quando existe, porque denúncia
          // com autor conhecido é mais fácil de julgar.
          reporterAccountId: request.account?.id ?? null,
          targetJobPostId: data.targetJobPostId ?? null,
          targetWorkerId: data.targetWorkerId ?? null,
          reason: data.reason,
          details: data.details ?? null,
        },
        select: { id: true, createdAt: true },
      });

      request.log.info(
        { reportId: report.id, reason: data.reason, ip: request.ip },
        "denúncia registrada",
      );

      return reply.status(201).send(
        success({
          id: report.id,
          createdAt: report.createdAt.toISOString(),
        }),
      );
    },
  );

  /**
   * Inscrição de push (§12).
   *
   * O `endpoint` é único no banco, então reinscrever o MESMO aparelho
   * atualiza a linha em vez de criar outra — sem isso, cada recarga do
   * service worker somaria uma inscrição e a pessoa receberia a mesma vaga
   * cinco vezes, que é o caminho mais curto para ela desligar a notificação
   * de vez.
   *
   * A subscription vai inteira para JSONB, sem desmontar: é payload de
   * terceiro, entregue como veio para a biblioteca de web-push.
   *
   * O corpo NUNCA entra em log — as `keys` são credencial de envio. Ver a
   * lista de redação em `server.ts`: nem por acidente, num erro de validação.
   */
  app.post(
    "/v1/push/subscribe",
    { preHandler: requireWorker },
    async (request, reply) => {
      const workerId = request.workerId;
      if (!workerId) return forbidden(reply);

      const parsed = pushSubscriptionSchema.safeParse(request.body);
      if (!parsed.success) {
        // Sem `err` e sem o corpo: a mensagem do zod já basta, e o input
        // carrega as chaves.
        return validationError(reply, parsed.error.issues[0]);
      }
      const subscription = parsed.data;

      const saved = await prisma.pushSubscription.upsert({
        where: { endpoint: subscription.endpoint },
        create: {
          workerId,
          endpoint: subscription.endpoint,
          subscription,
        },
        // Reinscrição do mesmo aparelho: renova as chaves e zera as falhas.
        // O `workerId` também é reescrito — aparelho emprestado ou conta
        // trocada no mesmo navegador passa a notificar quem está logado agora.
        update: {
          workerId,
          subscription,
          failureCount: 0,
        },
        select: { id: true, createdAt: true },
      });

      return reply.status(201).send(
        success({
          id: saved.id,
          createdAt: saved.createdAt.toISOString(),
        }),
      );
    },
  );

  /**
   * As vagas da empresa do token, em qualquer estado — aberta, preenchida,
   * fechada ou vencida. É o painel dela, e por isso NÃO é a listagem pública
   * filtrada: `GET /v1/jobs` só devolve vaga aberta e não vencida, e um painel
   * que esconde metade das vagas da própria empresa é um painel quebrado.
   *
   * A posse entra no WHERE, não num `if` depois da consulta: vaga de outra
   * empresa não é lida, então não há comparação para esquecer num refactor.
   *
   * `applicationsCount` já vem em `PublicJobPost` — é coluna mantida pelo
   * mesmo UPDATE que o CHECK do teto avalia, não um COUNT por vaga.
   */
  app.get(
    "/v1/companies/me/jobs",
    { preHandler: requireCompany },
    async (request, reply) => {
      const companyId = request.companyId;
      if (!companyId) return forbidden(reply);

      const rows = await prisma.jobPost.findMany({
        where: { companyId },
        include: jobInclude,
        // Mais recente primeiro: o painel abre no que a empresa acabou de
        // publicar, não no bico do ano passado.
        orderBy: { publishedAt: "desc" },
      });

      const body: PublicJobPost[] = rows.map(toPublicJobPost);
      return reply.send(success(body));
    },
  );

  /**
   * A fila de candidatos NOVOS (`applied`) de todas as vagas da empresa —
   * quem ainda não foi contactado nem confirmou. É o que o painel mostra
   * primeiro, porque candidato parado é vaga que não se resolve.
   *
   * Sem telefone (regra 8): a lista carrega `applicationId`, e quem quer
   * falar pede um número por vez em `GET /v1/applications/:id/contact`.
   *
   * A posse entra no WHERE pelo relacionamento — `jobPost: { companyId }` —
   * na mesma consulta que lê.
   */
  app.get(
    "/v1/companies/me/applicants",
    { preHandler: requireCompany },
    async (request, reply) => {
      const companyId = request.companyId;
      if (!companyId) return forbidden(reply);

      const rows = await prisma.application.findMany({
        where: {
          status: "applied",
          workerId: { not: null },
          jobPost: { companyId },
        },
        orderBy: { appliedAt: "desc" },
        include: { jobPost: { include: jobInclude } },
      });

      const workerIds = rows
        .map((row) => row.workerId)
        .filter((id): id is string => id !== null);

      const { publicById } = await loadWorkerProfiles(
        workerIds,
        undefined,
        companyId,
      );

      const body: NewApplicant[] = rows.flatMap(({ jobPost, ...application }) => {
        const worker = application.workerId
          ? publicById.get(application.workerId)
          : undefined;
        // Sem perfil na view: conta desativada. Some da fila em vez de
        // aparecer pela metade.
        if (!worker) return [];
        return [
          {
            application: toApplication(application),
            job: toPublicJobPost(jobPost),
            worker,
          },
        ];
      });

      return reply.send(success(body));
    },
  );
}
