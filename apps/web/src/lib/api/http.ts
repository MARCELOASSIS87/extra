import type { ApiResult } from "@extra/shared/types/api";
import { SESSION_TOKEN_HEADER } from "@extra/shared/constants/auth";
import { isMockMode } from "./mock";
import { err } from "./result";

/**
 * O cliente HTTP da Fase 4. Uma função só, porque a API já responde no mesmo
 * envelope `ApiResult` que esta camada devolve (§7.8): o corpo de sucesso e o
 * de erro atravessam sem tradução, e o que sobra aqui é o que o envelope não
 * cobre — rede caída, timeout, 5xx com HTML de proxy no lugar de JSON.
 *
 * Fora daqui ninguém chama `fetch`. Erro é valor de retorno, nunca exceção
 * (CLAUDE.md): o componente não distingue falha de rede de falha de regra, e
 * é por isso que os estados de erro escritos contra o mock continuam valendo.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

/**
 * Teto por requisição. O público é Android de entrada em 4G: sem corte, uma
 * conexão pendurada deixa a tela girando para sempre, que é pior que um erro.
 */
const TIMEOUT_MS = 15_000;

export const TOKEN_STORAGE_KEY = "extra_session_token";

/**
 * O token mora no `localStorage`, e a decisão tem uma razão só: o front é
 * estático e o servidor da API é outra origem, então cookie `HttpOnly` só
 * funcionaria com domínio comum e `SameSite` afrouxado — mais superfície
 * (CSRF) do que a que se quer evitar. Com token em header não existe envio
 * automático: nenhuma requisição de terceiro carrega credencial nossa.
 *
 * ponytail: o custo é XSS conseguir ler o token. A defesa é a versão de
 * sessão que já existe no servidor (`sessionVersion`) — incrementar a coluna
 * mata todo token vazado. Se um dia o front e a API ficarem na mesma origem
 * atrás do nginx, isto vira cookie HttpOnly e só este arquivo muda.
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    // Modo privado com storage bloqueado: sem token é o mesmo que deslogado.
    return null;
  }
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Nada a fazer: quem não guarda o token faz login de novo.
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  /** Query string já em pares; `undefined` é omitido. */
  query?: Record<string, string | number | undefined>;
}

/**
 * Uma requisição, devolvendo o `ApiResult` que a API mandou — ou um erro
 * nosso quando não houve resposta que se pudesse ler.
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const { method = "GET", body, query } = options;

  const url = new URL(path, BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const token = getToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // O token vai no header; cookie de sessão não existe neste desenho.
      credentials: "omit",
      cache: "no-store",
    });
  } catch (error) {
    // Rede caída, DNS, CORS e timeout chegam todos aqui, e todos significam
    // a mesma coisa para quem está olhando a tela: não deu, tente de novo.
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return err(
      "network_error",
      timedOut
        ? "A conexão demorou demais. Tente de novo."
        : "Não foi possível concluir. Tente de novo.",
    );
  }

  // Renovação silenciosa (§11.5): o servidor devolve um token novo passada a
  // metade da vida do atual, e o cliente troca sem tela de login.
  const renewed = response.headers.get(SESSION_TOKEN_HEADER);
  if (renewed) setToken(renewed);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    // 502 de proxy vem em HTML; corpo vazio vem em 204. Nos dois casos não há
    // envelope para ler, e inventar um `ok: true` seria pior que falhar.
    return err(
      "network_error",
      "Não foi possível concluir. Tente de novo.",
    );
  }

  // O envelope da API é o mesmo desta camada: passa direto, com erro e tudo.
  if (isApiResult<T>(payload)) return payload;

  // 5xx sem envelope, ou uma resposta que não é nossa.
  return err("network_error", "Não foi possível concluir. Tente de novo.");
}

const isApiResult = <T>(value: unknown): value is ApiResult<T> =>
  typeof value === "object" && value !== null && "ok" in value;

/**
 * O interruptor do §Fase 4: em `mock` nada aqui roda, em `live` é a única
 * implementação. Cada função de `lib/api/` começa por ele, para as duas
 * versões continuarem lado a lado no mesmo arquivo — a assinatura é uma só.
 */
export const isLiveMode = !isMockMode;
