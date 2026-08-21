import type { Availability } from "../types/worker";

// Rótulos de interface em português; o dado continua em inglês (§ convenções).
export const WEEKDAY_SHORT_LABELS = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
] as const;

export const PERIOD_LABELS: Record<Availability["period"], string> = {
  morning: "manhã",
  afternoon: "tarde",
  night: "noite",
};
