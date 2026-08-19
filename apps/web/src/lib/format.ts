import type { AttendanceSummary } from "@extra/shared/types/attendance";

const TIME_ZONE = "America/Sao_Paulo";

const dayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: TIME_ZONE,
});

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
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

/** "19:00" e "01:00" viram "19:00 às 01:00". */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime} às ${endTime}`;
}

const pluralize = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

/**
 * Número cru, sem estrela, nota, porcentagem ou cor de julgamento (CLAUDE.md,
 * regra 5). `worker.attendance` já vem filtrado sem contestados e sem
 * registro com mais de 12 meses — é o agregado, não a lista bruta (ver
 * comentário em mocks/fixtures.ts). Quem ainda não tem histórico (nenhuma
 * presença nem falta) retorna null para a tela mostrar "Novo por aqui" no
 * lugar, em vez de "0 presenças".
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
