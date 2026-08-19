import Link from "next/link";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import type { JobPost } from "@extra/shared/types/job";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import { formatJobDate, formatMoney, formatTimeRange } from "@/lib/format";
import { JOB_ROLE_ICONS } from "@/lib/job-role-icons";

/**
 * Cartão da vaga na listagem. O card inteiro é o link — alvo grande é o que
 * funciona no ônibus, com uma mão.
 */
export function JobCard({ job }: { job: JobPost }) {
  const RoleIcon = JOB_ROLE_ICONS[job.role];

  return (
    // min-w-0: item de grid, por padrão, nunca encolhe abaixo do conteúdo que
    // não quebra linha (o local truncado abaixo) — sem isso a coluna toda do
    // grid alarga para caber o cartão mais "largo" e a página passa a rolar
    // na horizontal em telas estreitas.
    <li className="min-w-0">
      <Link
        href={`/vagas/${job.slug}`}
        className="hover:border-primary/30 focus-visible:ring-ring block rounded-xl border p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="bg-secondary text-secondary-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium">
            <RoleIcon aria-hidden="true" className="size-3.5 shrink-0" />
            {JOB_ROLE_LABELS[job.role]}
          </span>
          {job.isHighlighted && (
            <span className="border-foreground/20 rounded-md border px-2 py-1 text-xs font-medium">
              Destaque
            </span>
          )}
        </div>

        <h3 className="mt-3 text-balance text-xl font-bold leading-snug tracking-tight">
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
          <div className="flex min-w-0 items-center gap-2">
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            <dt className="sr-only">Local</dt>
            {/* min-w-0: item de flex também não encolhe sozinho — sem isso o
                truncate não trunca de verdade, só corta quando já for tarde. */}
            <dd className="min-w-0 truncate">
              {job.neighborhood}, {job.city}
            </dd>
          </div>
        </dl>

        {/* O valor é o segundo elemento mais forte do card, depois do
            título: mais pesado e colorido que a meta acima, mas menor que o
            título (text-xl) — "depois do título" também vale em tamanho. */}
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
          <span className="text-primary text-lg font-bold">
            {formatMoney(job.payAmount)}
          </span>
          <span className="text-muted-foreground text-xs">
            valor informado pela empresa
          </span>
        </p>

        <p className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
          {job.vacancies > 1 && <span>{job.vacancies} vagas</span>}
          <span>
            {job.applicationsCount === 1
              ? "1 candidato"
              : `${job.applicationsCount} candidatos`}
          </span>
        </p>
      </Link>
    </li>
  );
}
