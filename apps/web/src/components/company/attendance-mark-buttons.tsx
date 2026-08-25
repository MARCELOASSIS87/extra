"use client";

import { useState } from "react";
import type { AttendanceStatus } from "@extra/shared/types/attendance";
import { markAttendance } from "@/lib/api/attendance";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MARKED_LABELS: Record<AttendanceStatus, string> = {
  present: "Você marcou que compareceu.",
  absent: "Você marcou que não compareceu.",
  not_selected: "Você marcou que não chamou esta pessoa.",
  // Contestação deixou de ser status (§7.4): "pending" é o registro que ainda
  // espera marcação, e para a empresa isso é o mesmo que não ter marcado.
  pending: "",
};

/**
 * As três saídas do §16.7 — não chamei / compareceu / não compareceu — num
 * clique só, sem texto livre. Só `absent` conta como falta; `not_selected` é
 * neutro e nunca aparece no perfil público.
 *
 * `onMarked` existe para a lista de pendências poder tirar o item da tela; sem
 * ele (tela de um candidato só) o próprio componente mostra o que foi
 * registrado.
 */
export function AttendanceMarkButtons({
  jobId,
  workerId,
  initialStatus = null,
  onMarked,
}: {
  jobId: string;
  workerId: string;
  initialStatus?: AttendanceStatus | null;
  onMarked?: () => void;
}) {
  const [marked, setMarked] = useState(initialStatus);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState(false);

  const mark = async (status: "present" | "absent" | "not_selected") => {
    setIsBusy(true);
    setError(false);

    const result = await markAttendance(jobId, { workerId, status });

    setIsBusy(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    if (onMarked) onMarked();
    else setMarked(status);
  };

  if (marked && marked !== "pending") {
    return (
      <p className="text-muted-foreground text-sm">{MARKED_LABELS[marked]}</p>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => mark("present")}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "flex-1",
          )}
        >
          Compareceu
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => mark("absent")}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "flex-1",
          )}
        >
          Faltou
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => mark("not_selected")}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "flex-1",
          )}
        >
          Não chamei
        </button>
      </div>

      {error && (
        <p role="alert" className="text-destructive mt-2 text-xs">
          Não foi possível registrar. Tente de novo.
        </p>
      )}
    </div>
  );
}
