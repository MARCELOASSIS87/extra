import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from "fastify";
import { SESSION_TOKEN_HEADER } from "@extra/shared/constants/auth";
import type { Account } from "@extra/shared/types/account";
import { failure } from "../http.js";
import { loadIdentity } from "./identity.js";
import { isHalfSpent, readSessionToken, signSessionToken } from "./token.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Quem está autenticado, ou `null`. Nunca vem do corpo nem da URL. */
    account: Account | null;
    workerId: string | null;
    companyId: string | null;
  }
}

/**
 * Resolve a conta em toda requisição, sem barrar nenhuma. Token ausente,
 * vencido ou de versão velha simplesmente deixa `request.account` em `null` —
 * quem barra são os `require*` abaixo, rota a rota.
 *
 * A separação existe porque metade das rotas é pública: `GET /v1/jobs` não
 * pode devolver 401 só porque o navegador guardou um token velho.
 */
export async function resolveAccount(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return;

  const claims = await readSessionToken(header.slice("Bearer ".length));
  if (!claims) return;

  const identity = await loadIdentity(claims.accountId);
  if (!identity) return;

  // A versão do token contra a do banco. É isto que transforma "incrementa a
  // coluna" em resposta a incidente: todo token daquela conta morre junto.
  if (identity.sessionVersion !== claims.sessionVersion) return;

  request.account = identity.account;
  request.workerId = identity.worker?.id ?? null;
  request.companyId = identity.company?.id ?? null;

  // Renovação silenciosa (§11.5): passada a metade da vida, o cliente recebe
  // um token novo no cabeçalho e não vê tela de login nenhuma.
  if (isHalfSpent(claims)) {
    reply.header(
      SESSION_TOKEN_HEADER,
      await signSessionToken(identity.account.id, identity.sessionVersion),
    );
  }
}

const unauthorized = (reply: FastifyReply): FastifyReply =>
  reply
    .status(401)
    .send(failure("unauthorized", "Entre de novo para continuar."));

export const requireAccount: preHandlerHookHandler = (request, reply, done) => {
  if (!request.account) return void unauthorized(reply);
  done();
};

/**
 * Perfil ausente é 403, não 404: a conta existe e o token é válido, só não é
 * dono daquele lado do produto. E a rota nunca conta qual perfil falta.
 */
const forbidden = (reply: FastifyReply): FastifyReply =>
  reply
    .status(403)
    .send(failure("forbidden", "Esta área não está disponível nesta conta."));

export const requireWorker: preHandlerHookHandler = (request, reply, done) => {
  if (!request.account) return void unauthorized(reply);
  if (!request.workerId) return void forbidden(reply);
  done();
};

export const requireCompany: preHandlerHookHandler = (request, reply, done) => {
  if (!request.account) return void unauthorized(reply);
  if (!request.companyId) return void forbidden(reply);
  done();
};

/** Liga o resolvedor e os campos que ele preenche. Chamado uma vez, no server. */
export function registerSession(app: FastifyInstance): void {
  app.decorateRequest("account", null);
  app.decorateRequest("workerId", null);
  app.decorateRequest("companyId", null);
  app.addHook("preHandler", resolveAccount);
}
