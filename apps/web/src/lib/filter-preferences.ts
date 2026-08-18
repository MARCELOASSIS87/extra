const ROLE_KEY = "extra:ultima-funcao";

/**
 * Guarda a última função escolhida para reaplicar na próxima visita.
 *
 * String vazia é uma escolha de verdade — "quero ver todas" — e diferente de
 * nunca ter escolhido: sem essa distinção, quem seleciona "Todas as funções"
 * voltaria filtrado no dia seguinte.
 */
export function readSavedRole(validValues: readonly string[]): string | null {
  try {
    const saved = window.localStorage.getItem(ROLE_KEY);
    if (saved === null || saved === "") return null;
    // localStorage é editável pelo usuário: só aceita o que ainda existe.
    return validValues.includes(saved) ? saved : null;
  } catch {
    // Modo privado ou storage cheio: seguir sem preferência é melhor que quebrar.
    return null;
  }
}

export function hasSavedRolePreference(): boolean {
  try {
    return window.localStorage.getItem(ROLE_KEY) !== null;
  } catch {
    return false;
  }
}

export function saveRole(role: string | null): void {
  try {
    window.localStorage.setItem(ROLE_KEY, role ?? "");
  } catch {
    // Sem preferência salva a interface continua funcionando.
  }
}
