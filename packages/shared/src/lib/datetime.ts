/**
 * O contrato guarda instante em ISO 8601 UTC (§7.5); a pessoa pensa em
 * "sábado, 19h em Poços de Caldas". Estas duas funções são a fronteira entre
 * as duas coisas, e moram em `shared` porque o formulário, a rota da API e a
 * tela precisam concordar sobre o mesmo fuso.
 */
export const TIME_ZONE = "America/Sao_Paulo";

const zoneParts = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Lê o instante no fuso e devolve os campos como números. */
function partsInZone(instant: Date): Record<string, number> {
  const parts: Record<string, number> = {};
  for (const { type, value } of zoneParts.formatToParts(instant)) {
    if (type !== "literal") parts[type] = Number(value);
  }
  // `hour12: false` ainda produz 24 para a meia-noite em alguns runtimes.
  if (parts.hour === 24) parts.hour = 0;
  return parts;
}

/** Quanto o fuso está adiantado em relação ao UTC naquele instante, em ms. */
function zoneOffsetMs(instant: Date): number {
  const p = partsInZone(instant);
  const asIfUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asIfUtc - instant.getTime();
}

/**
 * "2026-08-20" + "19:00" (hora de Poços) → instante ISO em UTC.
 *
 * Duas passadas de propósito: o deslocamento do fuso é função do instante, e
 * na virada de um horário de verão a primeira estimativa cai do lado errado.
 * O Brasil não tem horário de verão desde 2019 — mas já teve, pode voltar por
 * decreto, e uma vaga marcada uma hora errada é gente chegando na hora errada.
 */
export function saoPauloToUtc(date: string, time: string): string {
  const asIfUtc = Date.parse(`${date}T${time}:00Z`);
  const firstGuess = asIfUtc - zoneOffsetMs(new Date(asIfUtc));
  const instant = asIfUtc - zoneOffsetMs(new Date(firstGuess));
  return new Date(instant).toISOString();
}

/** Instante ISO → o dia do calendário em Poços, "YYYY-MM-DD". */
export function saoPauloDate(instant: string): string {
  const p = partsInZone(new Date(instant));
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Instante ISO → a hora do relógio em Poços, "HH:mm". */
export function saoPauloTime(instant: string): string {
  const p = partsInZone(new Date(instant));
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** O dia seguinte a uma data pura, sem passar por fuso nenhum. */
export function nextCalendarDay(date: string): string {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}
