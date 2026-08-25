import type { FastifyInstance } from "fastify";
import {
  MAX_CODES_PER_IP_PER_HOUR,
  MAX_CODES_PER_PHONE_PER_HOUR,
  OTP_CODE_LENGTH,
  OTP_TTL_MINUTES,
} from "@extra/shared/constants/auth";
import { attemptIdSchema, requestCodeSchema } from "@extra/shared/schemas/auth";
import type {
  AuthAttempt,
  AuthAttemptResult,
  AuthIdentity,
} from "@extra/shared/types/account";
import { prisma } from "../db.js";
import { failure, success } from "../http.js";
import { buildWaLink } from "../whatsapp.js";
import { loadIdentity } from "../auth/identity.js";
import { requireAccount } from "../auth/session.js";
import {
  hashAttemptId,
  hashCode,
  randomAttemptId,
  randomOtpCode,
  signSessionToken,
} from "../auth/token.js";

const anHourAgo = (): Date => new Date(Date.now() - 60 * 60 * 1000);

/**
 * A mesma resposta para tentativa inexistente, expirada e já consumida. São
 * três estados diferentes por dentro e um só por fora: distinguir conta a um
 * estranho, com o handle na mão, em que pé está o login de outra pessoa.
 */
const staleAttempt = () =>
  failure(
    "attempt_not_found",
    "Confirmação expirada. Peça um código novo para entrar.",
  );

export function registerAuthRoutes(app: FastifyInstance): void {
  /**
   * Passo 1–2 do §11.1. A resposta é idêntica para telefone cadastrado e não
   * cadastrado — nem campo a mais, nem mensagem diferente, nem consulta à
   * tabela `accounts`. Esta rota não sabe quem tem conta, e é assim que ela
   * deixa de ser um verificador de cadastro.
   */
  app.post("/v1/auth/request-code", async (request, reply) => {
    const { phone } = requestCodeSchema.parse(request.body);
    const since = anHourAgo();

    const [fromPhone, fromIp] = await Promise.all([
      prisma.phoneVerificationCode.count({
        where: { phone, createdAt: { gte: since } },
      }),
      prisma.phoneVerificationCode.count({
        where: { requestIp: request.ip, createdAt: { gte: since } },
      }),
    ]);

    if (
      fromPhone >= MAX_CODES_PER_PHONE_PER_HOUR ||
      fromIp >= MAX_CODES_PER_IP_PER_HOUR
    ) {
      request.log.info(
        { fromPhone, fromIp },
        "limite de códigos por hora atingido",
      );
      return reply
        .status(429)
        .send(
          failure(
            "too_many_requests",
            "Muitas tentativas. Espere uma hora para pedir outro código.",
          ),
        );
    }

    const code = randomOtpCode(OTP_CODE_LENGTH);
    const waLink = buildWaLink(code);

    if (!waLink) {
      request.log.error(
        "WHATSAPP_BUSINESS_NUMBER ausente — login indisponível",
      );
      return reply
        .status(503)
        .send(
          failure(
            "service_unavailable",
            "Não foi possível iniciar a confirmação. Tente de novo em alguns instantes.",
          ),
        );
    }

    const attemptId = randomAttemptId();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await prisma.phoneVerificationCode.create({
      data: {
        phone,
        codeHash: hashCode(phone, code),
        attemptIdHash: hashAttemptId(attemptId),
        requestIp: request.ip,
        expiresAt,
      },
    });

    const body: AuthAttempt = {
      attemptId,
      waLink,
      expiresAt: expiresAt.toISOString(),
    };
    return reply.send(success(body));
  });

  /**
   * Passo 8 do §11.1. Por `attemptId` e nunca por telefone: polling por número
   * deixa qualquer um perguntar, de fora, se um telefone tem conta aqui.
   */
  app.get<{ Params: { attemptId: string } }>(
    "/v1/auth/attempts/:attemptId",
    async (request, reply) => {
      const parsed = attemptIdSchema.safeParse(request.params.attemptId);
      if (!parsed.success) return reply.status(404).send(staleAttempt());

      const attempt = await prisma.phoneVerificationCode.findUnique({
        where: { attemptIdHash: hashAttemptId(parsed.data) },
        select: {
          id: true,
          phone: true,
          expiresAt: true,
          verifiedAt: true,
          consumedAt: true,
        },
      });

      if (
        !attempt ||
        attempt.consumedAt ||
        attempt.expiresAt.getTime() <= Date.now()
      ) {
        return reply.status(404).send(staleAttempt());
      }

      if (!attempt.verifiedAt) {
        const pending: AuthAttemptResult = { status: "pending" };
        return reply.send(success(pending));
      }

      // O consumo entra no `where`, não num `if` depois da leitura: dois
      // pollings simultâneos chegam aqui juntos, e só um pode sair com token.
      const consumed = await prisma.phoneVerificationCode.updateMany({
        where: { id: attempt.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) return reply.status(404).send(staleAttempt());

      const account = await prisma.account.findUnique({
        where: { phone: attempt.phone },
        select: { id: true },
      });
      // A conta nasce no webhook, junto com o phoneVerifiedAt. Não estar aqui
      // significa que alguém a apagou entre a confirmação e o polling.
      if (!account) return reply.status(404).send(staleAttempt());

      const identity = await loadIdentity(account.id);
      if (!identity) return reply.status(404).send(staleAttempt());

      const body: AuthAttemptResult = {
        status: "confirmed",
        token: await signSessionToken(
          identity.account.id,
          identity.sessionVersion,
        ),
        account: identity.account,
        worker: identity.worker,
        company: identity.company,
      };
      return reply.send(success(body));
    },
  );

  /** A conta e os perfis que existirem. O token já provou quem é. */
  app.get(
    "/v1/auth/me",
    { preHandler: requireAccount },
    async (request, reply) => {
      // `requireAccount` já barrou quem não tem conta; o TypeScript não
      // enxerga preHandler, então a checagem fica repetida aqui de graça.
      const identity = request.account
        ? await loadIdentity(request.account.id)
        : null;
      if (!identity) {
        return reply
          .status(401)
          .send(failure("unauthorized", "Entre de novo para continuar."));
      }

      const body: AuthIdentity = {
        account: identity.account,
        worker: identity.worker,
        company: identity.company,
      };
      return reply.send(success(body));
    },
  );
}
