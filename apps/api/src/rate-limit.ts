import type { FastifyReply, FastifyRequest } from "fastify";
import { failure } from "./http.js";

/**
 * Limite por IP das rotas públicas de leitura (§8). São o alvo óbvio de
 * raspagem: sem token, sem custo, e com o catálogo inteiro atrás.
 *
 * Um balde por IP, compartilhado pelas três rotas, e não um por rota: quem
 * raspa bate nas três, e três orçamentos separados são três vezes o teto.
 *
 * TODO: contador em memória, janela fixa. Vale enquanto a API for um
 * contêiner só — que é a arquitetura de hoje. Com dois, cada processo conta o
 * seu e o teto real dobra; aí o balde vai para o Redis.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;

/** Acima disto, poda os baldes vencidos: mapa sem poda é vazamento. */
const MAX_TRACKED_IPS = 20_000;

const buckets = new Map<string, { count: number; resetAt: number }>();

export async function publicReadRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_IPS) {
    for (const [ip, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(ip);
    }
  }

  const bucket = buckets.get(request.ip);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(request.ip, { count: 1, resetAt: now + WINDOW_MS });
    return undefined;
  }

  bucket.count += 1;
  if (bucket.count <= MAX_PER_WINDOW) return undefined;

  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
  request.log.info({ count: bucket.count }, "limite de leitura pública");
  return reply
    .status(429)
    .header("retry-after", String(retryAfter))
    .send(
      failure(
        "too_many_requests",
        "Muitas requisições. Espere alguns segundos e tente de novo.",
      ),
    );
}
