import { DEMO_ROLE_COOKIE, isMockMode, readCookie } from "./mock";
import { getToken, isLiveMode, request } from "./http";

export const SESSION_COOKIE = "extra_session";

export type SessionRole = "anonymous" | "worker" | "company";

/**
 * Quem está navegando, para o menu escolher entre Vagas/Publicar vaga/Entrar
 * (anônimo), Vagas/Minhas candidaturas/Perfil (trabalhador) ou
 * Painel/Publicar vaga/Minhas vagas (empresa).
 *
 * Não passa por withMock de propósito: ler cookie é local, não é chamada de
 * rede. Dar 300–800ms de latência e 5% de falha aqui faria o menu inteiro
 * piscar ou sumir a cada navegação.
 *
 * Passa por `readCookie` em vez de importar next/headers direto: as telas de
 * dado mutável chamam isto do navegador em modo mock, e um import estático
 * de next/headers derruba o módulo inteiro no bundle do cliente.
 *
 * Em modo mock o papel vem do seletor "ver como" da barra de demonstração —
 * que só existe ali. Em live quem responde é `GET /v1/auth/me`, pelo token:
 * a conta traz o perfil de trabalhador, o de empresa, ou nenhum dos dois.
 */
export async function getSessionRole(): Promise<SessionRole> {
  if (isMockMode) {
    const chosen = await readCookie(DEMO_ROLE_COOKIE);
    return chosen === "worker" || chosen === "company" ? chosen : "anonymous";
  }

  if (isLiveMode) {
    // Sem token nem se pergunta: é o caso comum (visitante), e uma ida à rede
    // para confirmar que ninguém está logado atrasaria todo primeiro acesso.
    if (!getToken()) return "anonymous";

    const me = await request<{
      worker: unknown | null;
      company: unknown | null;
    }>("/v1/auth/me");
    if (!me.ok) return "anonymous";
    if (me.data.company) return "company";
    if (me.data.worker) return "worker";
    return "anonymous";
  }

  return (await readCookie(SESSION_COOKIE)) ? "worker" : "anonymous";
}
