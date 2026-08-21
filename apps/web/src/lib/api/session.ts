import { cookies } from "next/headers";
import { DEMO_ROLE_COOKIE, isMockMode, readDemoCookie } from "./mock";

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
 * ponytail: sem verificação por WhatsApp ainda (§11), então fora do modo mock
 * não há como distinguir trabalhador de empresa — qualquer sessão real vira
 * "worker" (a única sessão real hoje é a de trabalhador). Em modo mock o
 * papel vem do seletor "ver como" da barra de demonstração.
 */
export async function getSessionRole(): Promise<SessionRole> {
  if (isMockMode) {
    const chosen = await readDemoCookie(DEMO_ROLE_COOKIE);
    return chosen === "worker" || chosen === "company" ? chosen : "anonymous";
  }

  const store = await cookies();
  return store.has(SESSION_COOKIE) ? "worker" : "anonymous";
}
