/**
 * Teto de candidaturas por vaga (§16.5). Vive aqui e em nenhum outro lugar:
 * é a única fonte da regra no repositório, e é por isso que o número 3 não
 * aparece solto em fixture, rota ou tela.
 *
 * O valor não é coluna. A API devolve pronto e o cliente só lê — se o
 * multiplicador mudar, quem já tinha o número guardado ficaria com o teto
 * velho, e a vaga fecharia candidatura na hora errada.
 */
const APPLICATIONS_PER_VACANCY = 3;

export function maxApplicationsFor(vacancies: number): number {
  return vacancies * APPLICATIONS_PER_VACANCY;
}

/**
 * O dia da semana e o período de uma vaga, no fuso de Poços — é contra estes
 * dois que a disponibilidade declarada pelo trabalhador é comparada.
 *
 * Derivado do INSTANTE de início, e no fuso local, porque é o relógio da
 * pessoa que decide: uma formatura que começa 22h de sábado é trabalho de
 * sábado à noite para quem vai, mesmo que em UTC já seja domingo.
 *
 * Vive aqui, e não dentro da rota, porque a contagem que a tela de publicar
 * mostra e o disparo do push precisam responder a mesma coisa (§16.2). Se a
 * conta que a tela mostra não for a mesma que decide o push, a tela mente.
 */
export function jobAvailabilitySlot(startsAt: string): {
  weekday: number;
  period: "morning" | "afternoon" | "night";
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
  }).formatToParts(new Date(startsAt));

  const weekdayName = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const rawHour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const hour = rawHour === 24 ? 0 : rawHour;

  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    weekdayName,
  );

  // Os mesmos cortes que a tela de disponibilidade oferece: manhã até meio-dia,
  // tarde até as 18h, noite o resto — inclusive a madrugada, que é quando o
  // bico de formatura de fato acontece.
  const period = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "night";

  return { weekday: weekday === -1 ? 0 : weekday, period };
}
