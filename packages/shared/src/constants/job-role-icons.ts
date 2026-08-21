import type { JobRole } from "../types/job";

/**
 * Nome do ícone (lucide-react) por função. Fica como string, não como
 * componente: packages/shared não importa React nem lucide — quem resolve o
 * nome para o componente de verdade é cada app que realmente renderiza.
 */
export const JOB_ROLE_ICON_NAMES: Record<JobRole, string> = {
  garcom: "UtensilsCrossed",
  cozinheiro: "ChefHat",
  auxiliar_cozinha: "CookingPot",
  auxiliar_limpeza: "BrushCleaning",
  diarista: "SprayCan",
  barman: "Martini",
  seguranca: "ShieldCheck",
  recepcionista: "ConciergeBell",
  montagem_evento: "HardHat",
  motorista: "CarFront",
  outro: "Ellipsis",
};
