import type { SubscriptionStatus } from "./company";
import type { WorkerStatus } from "./worker";

/**
 * A credencial, separada do perfil (§7.2). O telefone mora aqui e em nenhum
 * outro lugar — é o que impede a rota pública de vazar um campo que ela nem
 * enxerga (regra 8).
 *
 * `sessionVersion` não aparece neste tipo de propósito: é artefato de sessão
 * do servidor, não fato do domínio, e o cliente nunca precisa vê-lo.
 */
export interface Account {
  id: string;
  phone: string; // E.164 — ÚNICO. É o login
  phoneVerifiedAt: string | null;
  createdAt: string;
}

/**
 * O bastante para o menu escolher entre trabalhador e empresa e para a tela
 * saber o que falta. O perfil inteiro vem das rotas de domínio (§8) — sessão
 * não é lugar de carregar candidatura, disponibilidade e vaga.
 */
export interface AuthWorkerRef {
  id: string;
  fullName: string;
  status: WorkerStatus;
  profileCompletedAt: string | null;
}

export interface AuthCompanyRef {
  id: string;
  tradeName: string;
  subscriptionStatus: SubscriptionStatus;
}

/** Quem está logado. Uma conta pode ter os dois perfis (§7.2). */
export interface AuthIdentity {
  account: Account;
  worker: AuthWorkerRef | null;
  company: AuthCompanyRef | null;
}

export interface AuthSession extends AuthIdentity {
  token: string;
}

/**
 * Resposta de `POST /v1/auth/request-code`. Idêntica para telefone cadastrado
 * e não cadastrado: qualquer diferença — campo a mais, mensagem diferente,
 * tempo de resposta — transforma a rota num verificador de quem tem conta.
 *
 * O código de 6 dígitos vai dentro do `waLink` porque o OTP é invertido (§11.1):
 * quem manda a mensagem é o usuário. Ele volta para o mesmo cliente que pediu.
 */
export interface AuthAttempt {
  attemptId: string;
  waLink: string;
  expiresAt: string;
}

/**
 * Resposta do polling (§11.1, passo 8). `pending` enquanto a mensagem não
 * chegou; `confirmed` uma única vez, com a sessão. Tentativa inexistente,
 * expirada ou já consumida devolvem o mesmo erro — três respostas diferentes
 * contariam a um estranho em que pé está o login de outra pessoa.
 */
export type AuthAttemptResult =
  { status: "pending" } | ({ status: "confirmed" } & AuthSession);
