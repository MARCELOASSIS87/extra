"use client";

import { useState } from "react";
import type { JobPost } from "@extra/shared/types/job";
import type { WorkerPublicProfile } from "@extra/shared/types/worker";
import { markAttendance } from "@/lib/api/attendance";
import { buttonVariants } from "@/components/ui/button";
import { formatJobDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PendingItem {
  job: JobPost;
  worker: WorkerPublicProfile;
}

const itemKey = (item: PendingItem) => `${item.job.id}:${item.worker.id}`;

/**
 * Um clique por candidato, sem texto (§16.4) — a marcação acontece aqui
 * mesmo, no painel, e some da lista assim que confirmada.
 */
export function AttendancePendingList({ items }: { items: PendingItem[] }) {
  const [pending, setPending] = useState(items);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  if (pending.length === 0) {
    return (
      <p className="text-muted-foreground mt-3 text-sm">
        Nenhuma pendência de presença agora.
      </p>
    );
  }

  const mark = async (item: PendingItem, status: "present" | "absent") => {
    const key = itemKey(item);
    setBusyKey(key);
    setErrorKey(null);

    const result = await markAttendance(item.job.id, {
      workerId: item.worker.id,
      status,
    });

    setBusyKey(null);
    if (!result.ok) {
      setErrorKey(key);
      return;
    }
    setPending((current) => current.filter((entry) => itemKey(entry) !== key));
  };

  return (
    <ul className="mt-3 grid gap-3">
      {pending.map((item) => {
        const key = itemKey(item);
        const isBusy = busyKey === key;
        return (
          <li key={key} className="rounded-xl border p-4 shadow-sm">
            <p className="truncate font-medium">
              {item.worker.firstName} {item.worker.lastNameInitial}
            </p>
            <p className="text-muted-foreground mt-0.5 truncate text-sm">
              {item.job.title} · {formatJobDate(item.job.date)}
            </p>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => mark(item, "present")}
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
                onClick={() => mark(item, "absent")}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "flex-1",
                )}
              >
                Faltou
              </button>
            </div>

            {errorKey === key && (
              <p role="alert" className="text-destructive mt-2 text-xs">
                Não foi possível registrar. Tente de novo.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
