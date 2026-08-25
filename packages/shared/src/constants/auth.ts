/**
 * Política do OTP invertido (§11.4). Vive no shared porque o front conta o
 * mesmo tempo que o servidor: a tela mostra "o código expira em 10 minutos" e
 * o polling desiste na mesma hora em que o servidor para de aceitar.
 */

/** Dígitos do código enviado pelo WhatsApp. */
export const OTP_CODE_LENGTH = 6;

/** Validade do código e da tentativa. */
export const OTP_TTL_MINUTES = 10;

/** Teto por telefone por hora. Estourou, 429 — §11.4. */
export const MAX_CODES_PER_PHONE_PER_HOUR = 3;

/**
 * Teto por IP por hora, na geração. Folgado de propósito: a operadora móvel
 * põe meio estado atrás do mesmo IP (CGNAT), e um limite apertado aqui
 * derruba o login de gente que nunca tentou nada.
 */
export const MAX_CODES_PER_IP_PER_HOUR = 30;

/** Vida do JWT (§11.5). */
export const SESSION_TTL_DAYS = 30;

/** Polling do front: de 2 em 2 segundos, desistindo em 3 minutos (§11.1). */
export const AUTH_POLL_INTERVAL_MS = 2_000;
export const AUTH_POLL_TIMEOUT_MS = 180_000;

/**
 * Cabeçalho da renovação silenciosa (§11.5): passada a metade da vida do
 * token, a resposta traz um novo. Precisa estar em `exposedHeaders` do CORS,
 * senão o navegador recebe e esconde do JavaScript.
 */
export const SESSION_TOKEN_HEADER = "x-session-token";
