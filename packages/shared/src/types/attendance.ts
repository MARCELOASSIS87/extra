export interface AttendanceSummary {
  present: number;
  absent: number;
  distinctCompanies: number;
  // NUNCA existe rating, stars, score ou comment.
}

export type AttendanceStatus = "present" | "absent" | "disputed";

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
