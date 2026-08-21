import type { AttendanceSummary } from "@extra/shared/types/attendance";

const TIME_ZONE = "America/Sao_Paulo";

const dayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: TIME_ZONE,
});

const weekdayLongFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  timeZone: TIME_ZONE,
});

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: TIME_ZONE,
});

// Sem centavos nos dois sentidos: `payAmount` é real inteiro (schema), e o
// anúncio nunca pode exibir número diferente do que a empresa digitou.
const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * `JobPost.date` é data pura (YYYY-MM-DD), sem hora. Ancorar ao meio-dia UTC
 * evita o clássico "volta um dia" ao formatar em America/Sao_Paulo (UTC-3).
 */
export function formatJobDate(date: string): string {
  return dayFormatter.format(new Date(`${date}T12:00:00Z`));
}

export function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

/**
 * "sábado" + "22/08" — por extenso, para as mensagens prontas de WhatsApp
 * (candidatura em job-apply-panel.tsx e compartilhar em share-job-button.tsx),
 * que escrevem a data por extenso em vez do formato curto de `formatJobDate`.
 */
export function formatJobWeekdayAndDate(
  date: string,
): { weekday: string; shortDate: string } {
  const jobDate = new Date(`${date}T12:00:00Z`);
  return {
    weekday: weekdayLongFormatter.format(jobDate),
    shortDate: shortDateFormatter.format(jobDate),
  };
}

/** "19:00" e "01:00" viram "19:00 às 01:00". */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime} às ${endTime}`;
}

const pluralize = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

/**
 * Número cru, sem estrela, nota, porcentagem ou cor de julgamento (CLAUDE.md,
 * regra 5). O agregado já chega sem contestados e sem registro com mais de 12
 * meses — quem filtra é `computeAttendanceSummary()` em lib/api/mock.ts, na
 * hora, a partir de `attendanceRecords`. Quem ainda não tem histórico
 * (nenhuma presença nem falta) retorna null para a tela mostrar "Novo por
 * aqui" no lugar, em vez de "0 presenças".
 */
export function formatAttendanceSummary(
  attendance: AttendanceSummary,
): string | null {
  const { present, absent, distinctCompanies } = attendance;
  if (present === 0 && absent === 0) return null;

  return [
    pluralize(present, "presença", "presenças"),
    pluralize(absent, "falta", "faltas"),
    pluralize(distinctCompanies, "empresa", "empresas"),
  ].join(" · ");
}
