import type { AttendanceStatus } from "../types/attendance";

/**
 * Como cada desfecho aparece no HISTÓRICO DO PRÓPRIO TRABALHADOR (§16.7).
 *
 * A tela é dele, então `not_selected` aparece — silêncio é pior que
 * informação: quem se candidatou e nunca soube de nada fica recarregando a
 * lista. Mas o texto é NEUTRO, e essa é a regra inteira: o desfecho descreve
 * a VAGA, nunca a pessoa.
 *
 * "Não seguiu" e não "você não foi escolhido"; "não registrada" e não
 * "você faltou". A plataforma não seleciona ninguém e não pune ninguém
 * (regras 3 e 4 do CLAUDE.md) — escrever como se ela julgasse é o que
 * transforma um registro operacional em veredito sobre alguém.
 *
 * Conferido contra o vocabulário proibido: nenhuma destas frases usa
 * "verificado", "aprovado", "confiável", "garantido", "selecionado por nós"
 * nem qualquer forma de "escolhido".
 */
export const MY_ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  // Ainda dá tempo de a empresa marcar. Não é promessa de que ela vai.
  pending: "Aguardando a empresa",
  // O desfecho neutro: fala da vaga, não de quem se candidatou.
  not_selected: "Não seguiu",
  present: "Presença registrada",
  // Descreve o registro, não a pessoa. Nunca "você faltou".
  absent: "Presença não registrada",
};

/**
 * A linha de apoio, quando a tela tem espaço. Mesma regra: descreve o que
 * aconteceu com a vaga, e diz que não há consequência quando não há.
 */
export const MY_ATTENDANCE_HINTS: Record<AttendanceStatus, string | null> = {
  pending: "A empresa ainda pode registrar como foi.",
  not_selected: "Esta vaga não seguiu com você. Isso não afeta seu histórico.",
  present: null,
  absent: "Você pode contestar em até 7 dias.",
};
