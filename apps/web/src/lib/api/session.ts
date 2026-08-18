import { cookies } from "next/headers";

export const SESSION_COOKIE = "extra_session";

/**
 * Só responde "tem sessão ou não" — é o que a navegação precisa hoje.
 *
 * Não passa por withMock de propósito: ler cookie é local, não é chamada de
 * rede. Dar 300–800ms de latência e 5% de falha aqui faria o menu inteiro
 * piscar ou sumir a cada navegação.
 *
 * ponytail: booleano por enquanto. Vira getSession() com id e papel
 * (trabalhador/empresa) quando a verificação por WhatsApp do §11 existir —
 * aí a empresa passa a ver "Painel" no lugar de "Candidaturas".
 */
export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return store.has(SESSION_COOKIE);
}
