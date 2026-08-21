export interface AttendanceSummary {
  present: number;
  absent: number;
  distinctCompanies: number;
  // NUNCA existe rating, stars, score ou comment.
}

// "not_selected" é neutro: não entra em present nem em absent, nunca aparece
// no perfil público (§16.7).
export type AttendanceStatus =
  | "present"
  | "absent"
  | "not_selected"
  | "disputed";

// A empresa marca presente, ausente ou "não chamei" (§16.7). "disputed" nasce
// da contestação do trabalhador (§16.4), nunca de quem marca.
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
  markedAt: string;
  disputedAt: string | null; // contestação em até 7 dias
  expiresAt: string; // markedAt + 12 meses
  // Sem campo de texto livre. É a regra que evita ação por dano moral.
}
