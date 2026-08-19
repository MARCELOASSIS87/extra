import type { WorkerPublicProfile } from "@extra/shared/types/worker";
import { formatAttendanceSummary } from "@/lib/format";

/**
 * Selo de perfil completo + histórico de presença, sempre juntos (§ regra 5
 * do CLAUDE.md: número cru, sem estrela, sem cor de julgamento). Quem ainda
 * não tem histórico mostra "Novo por aqui" em vez de "0 presenças".
 */
export function WorkerAttendanceSummary({
  worker,
}: {
  worker: WorkerPublicProfile;
}) {
  const summary = formatAttendanceSummary(worker.attendance);

  return (
    <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {worker.hasCompleteProfile && (
        <span className="bg-secondary text-secondary-foreground rounded-md px-2 py-0.5 font-medium">
          Perfil completo
        </span>
      )}
      <span>{summary ?? "Novo por aqui"}</span>
    </p>
  );
}
