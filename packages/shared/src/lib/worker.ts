import type { WorkerStatus } from "../types/worker";

/**
 * O que o cadastro precisa ter para deixar de ser `incomplete` (§16.1).
 *
 * O VÍDEO NÃO ENTRA: quem não grava conclui o cadastro do mesmo jeito, recebe
 * aviso e se candidata igual. O vídeo é o que dá o SELO, não o que libera a
 * plataforma — travar alguém por não ter gravado é exatamente o abandono
 * silencioso que a regra da casa manda evitar.
 */
export interface WorkerCompleteness {
  documentSelfieKey: string | null;
  roles: unknown[];
  availability: unknown[];
  neighborhood: string;
  introVideoKey: string | null;
  /** `self_deactivated` é escolha da pessoa e não se desfaz por um PATCH. */
  currentStatus: WorkerStatus;
  /** Já ganho antes, se houver: o selo não se recarimba a cada PATCH. */
  currentProfileCompletedAt: string | null;
}

export function isProfileComplete(worker: WorkerCompleteness): boolean {
  return (
    worker.documentSelfieKey !== null &&
    worker.roles.length > 0 &&
    worker.availability.length > 0 &&
    worker.neighborhood !== ""
  );
}

/**
 * O status e o selo depois de um PATCH, decididos num lugar só — a API e o
 * mock precisam concordar, senão a mesma edição conclui o cadastro numa e não
 * na outra.
 *
 * Só o próprio usuário desativa a conta (regra 3): quem está
 * `self_deactivated` não volta a `complete` por uma edição de perfil, só pela
 * rota de reativação.
 *
 * O selo é o vídeo E o cadastro concluído. Uma vez ganho não se recarimba;
 * some se a pessoa apagar o vídeo ou o cadastro deixar de estar completo.
 */
export function resolveWorkerStatus(worker: WorkerCompleteness): {
  status: WorkerStatus;
  profileCompletedAt: string | null;
} {
  if (worker.currentStatus === "self_deactivated") {
    return {
      status: "self_deactivated",
      profileCompletedAt: worker.currentProfileCompletedAt,
    };
  }

  const complete = isProfileComplete(worker);
  const status: WorkerStatus = complete ? "complete" : "incomplete";
  const earnedBadge = complete && worker.introVideoKey !== null;

  return {
    status,
    profileCompletedAt: earnedBadge
      ? (worker.currentProfileCompletedAt ?? new Date().toISOString())
      : null,
  };
}
