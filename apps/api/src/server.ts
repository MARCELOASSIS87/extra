import cors from "@fastify/cors";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { SESSION_TOKEN_HEADER } from "@extra/shared/constants/auth";
import type { ApiResult } from "@extra/shared/types/api";
import { registerSession } from "./auth/session.js";
import { failure } from "./http.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerWhatsappWebhook } from "./routes/whatsapp.js";
import { isDatabaseReachable } from "./db.js";
import { env, isProduction } from "./env.js";

/**
 * Campos que nunca podem sobrar num arquivo de log: log vaza igual banco, e
 * vaza por caminhos que ninguém audita (agregador, backup, print no chat).
 * Os curingas pegam o campo em qualquer nível do corpo, porque o schema da
 * requisição muda e a lista de caminhos exatos não acompanha.
 */
const REDACTED_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
  "cpf",
  "phone",
  "code",
  "*.cpf",
  "*.phone",
  "*.code",
  "req.body.cpf",
  "req.body.phone",
  "req.body.code",
];

/** Um código estável por família de status — o cliente liga o erro à tela. */
const CODE_BY_STATUS: Record<number, string> = {
  400: "validation_error",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  429: "too_many_requests",
};

/**
 * Monta a instância e devolve sem escutar porta. É essa separação que deixa
 * um teste subir o app inteiro sem abrir socket nenhum — quem escuta é o
 * index.ts.
 */
export function buildServer(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: isProduction ? "info" : "debug",
      redact: { paths: REDACTED_PATHS, censor: "[oculto]" },
    },
    // O front e a API ficam atrás do mesmo nginx: sem isto o IP de todo mundo
    // é o do proxy, e rate limit por IP (§21) viraria rate limit global.
    trustProxy: true,
  });

  // Origem única, nunca `origin: true`: refletir a origem do pedido aceita
  // qualquer site, que é o mesmo que não ter CORS.
  app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    // Sem isto o navegador RECEBE o token renovado e esconde do JavaScript,
    // e a renovação silenciosa (§11.5) vira um cabeçalho que ninguém lê.
    exposedHeaders: [SESSION_TOKEN_HEADER],
  });

  // Resolve a conta de toda requisição antes das rotas. Não barra ninguém:
  // quem barra são os require* de cada rota.
  registerSession(app);

  /**
   * Toda resposta de erro sai no formato `ApiResult` (§7.8) — inclusive as
   * que o Fastify gera sozinho. Detalhe vai para o log, nunca para o corpo:
   * mensagem do Prisma entrega nome de tabela e coluna, e stack trace entrega
   * caminho de arquivo.
   */
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      request.log.info({ err: error }, "falha de validação");
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

    // Validação de schema da própria rota (Fastify), mesma resposta.
    if (error.validation) {
      const first = error.validation[0];
      request.log.info({ err: error }, "falha de validação");
      return reply
        .status(400)
        .send(
          failure(
            "validation_error",
            first?.message ?? "Dados inválidos.",
            first?.instancePath?.replace(/^\//, "") || undefined,
          ),
        );
    }

    const status = error.statusCode ?? 500;

    if (status < 500) {
      request.log.info({ err: error }, "requisição recusada");
      return reply
        .status(status)
        .send(
          failure(CODE_BY_STATUS[status] ?? "request_error", error.message),
        );
    }

    // 5xx: log completo de um lado, resposta genérica do outro.
    request.log.error({ err: error }, "erro não tratado");
    return reply
      .status(500)
      .send(
        failure(
          "internal_error",
          "Não foi possível concluir. Tente de novo em alguns instantes.",
        ),
      );
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send(failure("not_found", "Recurso não encontrado.")),
  );

  /**
   * Healthcheck que toca o banco. Sem o `SELECT 1` ele responde "ok" com o
   * Postgres fora do ar, e o balanceador continua mandando tráfego para um
   * processo que não consegue responder nada.
   *
   * Banco fora é falha, e falha sai como falha: `ok: false` com 503, a mesma
   * forma de qualquer outro erro (§7.8). Um corpo `ok: true` dizendo
   * "degraded" obriga quem consome a ler um campo interno para descobrir que
   * deu errado — e quem não lê trata a queda como sucesso.
   */
  app.get("/health", async (_request, reply) => {
    if (!(await isDatabaseReachable())) {
      return reply
        .status(503)
        .send(failure("db_unavailable", "Banco de dados indisponível."));
    }

    const body: ApiResult<{ status: string; db: string }> = {
      ok: true,
      data: { status: "ok", db: "up" },
    };
    return reply.send(body);
  });

  registerAuthRoutes(app);
  registerWhatsappWebhook(app);

  return app;
}
