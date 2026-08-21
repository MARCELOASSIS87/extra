"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import type { JobPost } from "@extra/shared/types/job";
import type { WorkerApplicantProfile } from "@extra/shared/types/worker";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import { AttendanceMarkButtons } from "@/components/company/attendance-mark-buttons";
import { WhatsappButton } from "@/components/contact/whatsapp-button";
import { formatJobDate, formatTimeRange } from "@/lib/format";

interface PendingItem {
  job: JobPost;
  worker: WorkerApplicantProfile;
  shortCode: string;
  workerPhone: string;
}

const itemKey = (item: PendingItem) => `${item.job.id}:${item.worker.id}`;

/**
 * Um clique por candidato, sem texto (§16.4) — a marcação acontece aqui
 * mesmo, no painel, e some da lista assim que confirmada.
 *
 * O cartão repete vaga e pessoa por inteiro porque a empresa marca dias
 * depois do evento: sem nome, função, data e local juntos, quem marca não
 * lembra quem foi nem em qual vaga.
 */
export function AttendancePendingList({ items }: { items: PendingItem[] }) {
  const [pending, setPending] = useState(items);

  if (pending.length === 0) {
    return (
      <p className="text-muted-foreground mt-3 text-sm">
        Nenhuma pendência de presença agora.
      </p>
    );
  }

  const remove = (key: string) =>
    setPending((current) => current.filter((entry) => itemKey(entry) !== key));

  return (
    <ul className="mt-3 grid gap-3">
      {pending.map((item) => {
        const key = itemKey(item);
        return (
          <li key={key} className="rounded-xl border p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.worker.fullName}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {JOB_ROLE_LABELS[item.job.role]}
                </p>
              </div>
              <span className="bg-secondary text-secondary-foreground shrink-0 rounded-md px-2 py-1 text-xs font-medium">
                Código {item.shortCode}
              </span>
            </div>

            <Link
              href={`/vagas/${item.job.slug}`}
              className="mt-3 block font-medium leading-snug underline-offset-4 hover:underline"
            >
              {item.job.title}
            </Link>

            <dl className="text-muted-foreground mt-2 space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
                <dt className="sr-only">Data</dt>
                <dd className="first-letter:uppercase">
                  {formatJobDate(item.job.date)}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <Clock aria-hidden="true" className="size-4 shrink-0" />
                <dt className="sr-only">Horário</dt>
                <dd>
                  {formatTimeRange(item.job.startTime, item.job.endTime)}
                </dd>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <MapPin aria-hidden="true" className="size-4 shrink-0" />
                <dt className="sr-only">Bairro</dt>
                <dd className="min-w-0 truncate">{item.job.neighborhood}</dd>
              </div>
            </dl>

            <div className="mt-3">
              <WhatsappButton
                phone={item.workerPhone}
                label={`Falar com ${item.worker.firstName}`}
              />
            </div>

            <div className="mt-3">
              <AttendanceMarkButtons
                jobId={item.job.id}
                workerId={item.worker.id}
                onMarked={() => remove(key)}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
