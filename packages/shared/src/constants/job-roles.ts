import type { JobRole } from "../types/job.js";

// Rótulos que aparecem na interface e, depois, no texto da notificação push.
// Ficam aqui para o front e a API dizerem a mesma coisa.
export const JOB_ROLE_LABELS: Record<JobRole, string> = {
  garcom: "Garçom",
  cozinheiro: "Cozinheiro",
  auxiliar_cozinha: "Auxiliar de cozinha",
  auxiliar_limpeza: "Auxiliar de limpeza",
  diarista: "Diarista",
  barman: "Barman",
  seguranca: "Segurança",
  recepcionista: "Recepcionista",
  montagem_evento: "Montagem de evento",
  motorista: "Motorista",
  outro: "Outra função",
};
