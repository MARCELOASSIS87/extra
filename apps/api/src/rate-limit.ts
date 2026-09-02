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

/**
 * Denúncia tem teto próprio, e bem mais baixo. É porta de abuso nos dois
 * sentidos: enxurrada para derrubar um anúncio legítimo, ou para afogar a
 * fila de moderação até ninguém mais olhar. Quem denuncia de verdade denuncia
 * uma vez.
 */
const MAX_REPORTS_PER_WINDOW = 5;

/** Acima disto, poda os baldes vencidos: mapa sem poda é vazamento. */
const MAX_TRACKED_IPS = 20_000;

const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Um balde por chave. A chave carrega o nome do limite, então leitura pública
 * e denúncia contam separado — senão navegar gastaria o orçamento de denunciar.
 */
function consume(ip: string, name: string, max: number): number | null {
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_IPS) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  const key = `${name}:${ip}`;
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  bucket.count += 1;
  if (bucket.count <= max) return null;
  return Math.ceil((bucket.resetAt - now) / 1000);
}

const tooMany = (reply: FastifyReply, retryAfter: number): FastifyReply =>
  reply
    .status(429)
    .header("retry-after", String(retryAfter))
    .send(
      failure(
        "too_many_requests",
        "Muitas requisições. Espere alguns segundos e tente de novo.",
      ),
    );

export async function publicReadRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  const retryAfter = consume(request.ip, "read", MAX_PER_WINDOW);
  if (retryAfter === null) return undefined;

  request.log.info("limite de leitura pública");
  return tooMany(reply, retryAfter);
}

/** Teto apertado do §14.4 — ver `MAX_REPORTS_PER_WINDOW`. */
export async function reportRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  const retryAfter = consume(request.ip, "report", MAX_REPORTS_PER_WINDOW);
  if (retryAfter === null) return undefined;

  request.log.warn("limite de denúncias atingido");
  return tooMany(reply, retryAfter);
}
