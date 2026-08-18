import Link from "next/link";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import type { JobPost } from "@extra/shared/types/job";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import { formatJobDate, formatMoney, formatTimeRange } from "@/lib/format";

/**
 * Cartão da vaga na listagem. O card inteiro é o link — alvo grande é o que
 * funciona no ônibus, com uma mão.
 */
export function JobCard({ job }: { job: JobPost }) {
  return (
    <li>
      <Link
        href={`/vagas/${job.slug}`}
        className="hover:bg-muted/50 focus-visible:ring-ring block rounded-lg border p-4 focus-visible:outline-none focus-visible:ring-2"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="bg-secondary text-secondary-foreground rounded-md px-2 py-1 text-xs font-medium">
            {JOB_ROLE_LABELS[job.role]}
          </span>
          {job.isHighlighted && (
            <span className="border-foreground/20 rounded-md border px-2 py-1 text-xs font-medium">
              Destaque
            </span>
          )}
        </div>

        <h3 className="mt-3 text-balance font-semibold leading-snug">
          {job.title}
        </h3>

        <dl className="text-muted-foreground mt-3 space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
            <dt className="sr-only">Data</dt>
            <dd className="first-letter:uppercase">
              {formatJobDate(job.date)}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <Clock aria-hidden="true" className="size-4 shrink-0" />
            <dt className="sr-only">Horário</dt>
            <dd>{formatTimeRange(job.startTime, job.endTime)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            <dt className="sr-only">Local</dt>
            <dd className="truncate">
              {job.neighborhood}, {job.city}
            </dd>
          </div>
        </dl>

        <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
          <span className="text-lg font-semibold">
            {formatMoney(job.payAmount)}
          </span>
          <span className="text-muted-foreground text-xs">
            valor informado pela empresa
          </span>
        </p>

        {job.vacancies > 1 && (
          <p className="text-muted-foreground mt-1 text-xs">
            {job.vacancies} vagas
          </p>
        )}
      </Link>
    </li>
  );
}
