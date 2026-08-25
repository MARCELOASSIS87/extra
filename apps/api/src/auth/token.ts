import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { SESSION_TTL_DAYS } from "@extra/shared/constants/auth";
import { env } from "../env.js";

const secret = new TextEncoder().encode(env.JWT_SECRET);
const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;

export interface SessionClaims {
  accountId: string;
  sessionVersion: number;
  /** Segundos desde a época, como o JWT guarda. */
  issuedAt: number;
  expiresAt: number;
}

/**
 * HS256 por biblioteca, não à mão. Verificação de JWT escrita na pressa é
 * onde nascem confusão de algoritmo (`alg: none`), comparação não constante e
 * `exp` lido como string — três formas de aceitar um token que não emitimos.
 */
export async function signSessionToken(
  accountId: string,
  sessionVersion: number,
): Promise<string> {
  return new SignJWT({ sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(accountId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(secret);
}

/**
 * Devolve as claims ou `null`. Token inválido é caso esperado — expira,
 * chega truncado, vem de outro ambiente — e caso esperado não é exceção.
 */
export async function readSessionToken(
  token: string,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    const version = payload.sessionVersion;
    if (
      typeof payload.sub !== "string" ||
      typeof version !== "number" ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    return {
      accountId: payload.sub,
      sessionVersion: version,
      issuedAt: payload.iat,
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}

/** Renovação silenciosa (§11.5): passada a metade da vida, vale um token novo. */
export function isHalfSpent(claims: SessionClaims): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now >= claims.issuedAt + SESSION_TTL_SECONDS / 2;
}

/** Código de 6 dígitos. Um bloco de bytes em vez de seis chamadas. */
export function randomOtpCode(length: number): string {
  return Array.from(randomBytes(length), (byte) => byte % 10).join("");
}

/** 32 bytes opacos. base64url para caber na URL do polling sem escapar nada. */
export function randomAttemptId(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * HMAC com o segredo do servidor, nunca hash puro: o espaço de um código de 6
 * dígitos é um milhão, e um dump com SHA-256 solto se reverte num notebook.
 * O telefone entra na mensagem para que o mesmo código em números diferentes
 * não dê o mesmo hash.
 */
export function hashCode(phone: string, code: string): string {
  return createHmac("sha256", env.JWT_SECRET)
    .update(`otp:${phone}:${code}`)
    .digest("hex");
}

/**
 * O attemptId já é aleatório de 32 bytes, então não há o que forçar por
 * dicionário: SHA-256 basta, e mantém a coluna com um formato só.
 */
export function hashAttemptId(attemptId: string): string {
  return createHash("sha256").update(attemptId).digest("hex");
}

/** Comparação de segredo sem vazar o ponto em que os bytes divergem. */
export function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}
