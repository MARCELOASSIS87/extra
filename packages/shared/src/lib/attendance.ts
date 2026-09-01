import type { AttendanceRecord, AttendanceStatus } from "../types/attendance";

/** Um registro some do perfil público depois disto (§7.4). */
export const ATTENDANCE_HISTORY_MONTHS = 12;

/** Prazo do trabalhador para contestar, contado da marcação (§16.4). */
export const DISPUTE_WINDOW_DAYS = 7;

/**
 * Prazo da empresa para marcar, contado do FIM do trabalho (§16.7). Passado
 * isso, a pendência vira `not_selected` sozinha.
 *
 * Constante própria, e não `DISPUTE_WINDOW_DAYS` reaproveitada: são dois
 * prazos que hoje valem 7 e não são a mesma regra — um é o direito de
 * contestar, o outro é o silêncio da empresa virando desfecho neutro. Mudar
 * um nunca deveria mexer no outro por acidente.
 */
export const AUTO_NOT_SELECTED_DAYS = 7;

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

/**
 * O status EFETIVO de uma marcação (§16.7, regra 10).
 *
 * Passados 7 dias do fim do trabalho sem ninguém marcar, a pendência vira
 * `not_selected` — nunca `absent`. Falta só existe se alguém marcar: sem esse
 * desfecho neutro, ou o painel entope de pendência, ou a empresa marca falta
 * só para limpar a lista, e aí a plataforma pune quem nunca foi chamado.
 *
 * Vale mesmo com `contactedAt` preenchido. A empresa ter chamado no WhatsApp
 * não é prova de que a pessoa foi contratada, muito menos de que faltou — só
 * de que houve conversa. Deduzir falta do silêncio é exatamente o que a regra
 * 10 proíbe.
 *
 * DERIVADO na leitura, igual a vaga vencida: o que está gravado continua
 * `pending`. Um cron pode um dia materializar a coluna, mas nunca é a fonte
 * da verdade — entre o sétimo dia e a passada do cron, quem responde é isto.
 */
export function effectiveAttendanceStatus(
  record: { status: AttendanceStatus; markedAt: string | null },
  jobEndsAt: string,
  now: string,
): AttendanceStatus {
  if (record.status !== "pending") return record.status;

  const deadline = new Date(jobEndsAt);
  deadline.setUTCDate(deadline.getUTCDate() + AUTO_NOT_SELECTED_DAYS);
  return deadline.toISOString() < now ? "not_selected" : "pending";
}
