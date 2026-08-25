import type { AttendanceRecord } from "../types/attendance";

/** Um registro some do perfil público depois disto (§7.4). */
export const ATTENDANCE_HISTORY_MONTHS = 12;

/** Prazo do trabalhador para contestar, contado da marcação (§16.4). */
export const DISPUTE_WINDOW_DAYS = 7;

/**
 * `markedAt` + 12 meses, calculado na leitura. Não existe coluna: guardar a
 * data de expiração seria uma segunda fonte de verdade para uma constante.
 */
export function attendanceExpiresAt(markedAt: string): string {
  const expires = new Date(markedAt);
  expires.setUTCMonth(expires.getUTCMonth() + ATTENDANCE_HISTORY_MONTHS);
  return expires.toISOString();
}

/**
 * "Em contestação" é a ausência de resolução, não um valor de status — é o
 * que faz a marcação original sobreviver à contestação (§7.4).
 */
export function isUnderDispute(record: AttendanceRecord): boolean {
  return record.disputedAt !== null && record.disputeResolvedAt === null;
}

/**
 * Entra na contagem pública: foi marcado, ainda está dentro dos 12 meses e
 * não está em contestação. Contestado sai da conta até alguém resolver.
 */
export function countsInPublicHistory(
  record: AttendanceRecord,
  now: string,
): boolean {
  if (record.markedAt === null) return false;
  if (isUnderDispute(record)) return false;
  return attendanceExpiresAt(record.markedAt) > now;
}
