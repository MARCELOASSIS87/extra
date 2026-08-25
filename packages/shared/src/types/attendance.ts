export interface AttendanceSummary {
  present: number;
  absent: number;
  distinctCompanies: number;
  // false → a UI escreve "Novo por aqui", NUNCA "0 presenças" (§16.6). Quem
  // decide é o servidor: a interface nunca interpreta um zero.
  hasHistory: boolean;
  // NUNCA existe rating, stars, score ou comment.
}

/**
 * Só o que a empresa marcou. Contestação é outra dimensão (ver
 * `AttendanceRecord`): se fosse valor de status, contestar uma falta apagaria
 * a marcação original.
 *
 * "not_selected" é neutro: não entra em present nem em absent e nunca aparece
 * no perfil público (§16.7).
 */
export type AttendanceStatus =
  | "pending" // aguardando a empresa marcar
  | "not_selected" // não foi chamado — NEUTRO
  | "present" // foi chamado e compareceu
  | "absent"; // foi chamado e NÃO compareceu — só isto é falta

export type DisputeOutcome = "upheld" | "reversed";

// A empresa marca presente, ausente ou "não chamei" (§16.7). "pending" é o
// estado de partida, nunca uma escolha de quem marca.
export interface AttendanceMarkInput {
  workerId: string;
  status: Extract<AttendanceStatus, "present" | "absent" | "not_selected">;
}

export interface AttendanceRecord {
  id: string;
  workerId: string;
  companyId: string;
  jobPostId: string;
  status: AttendanceStatus;
  markedAt: string | null; // null enquanto o status é "pending"
  // Contestar não apaga a marcação: `status` continua sendo o que a empresa
  // marcou. "Em contestação" é disputedAt != null && disputeResolvedAt == null.
  disputedAt: string | null; // contestação em até 7 dias
  disputeResolvedAt: string | null;
  disputeOutcome: DisputeOutcome | null;
  // Sem expiresAt: é markedAt + 12 meses, calculado na leitura. Cópia
  // guardada seria uma segunda fonte de verdade para um valor derivado.
  // Sem campo de texto livre. É a regra que evita ação por dano moral.
}
