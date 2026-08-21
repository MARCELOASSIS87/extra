import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import type { Application } from "@extra/shared/types/application";
import type { JobPost } from "@extra/shared/types/job";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import { JobApplyPanel } from "@/components/jobs/job-apply-panel";
import { ShareJobButton } from "@/components/jobs/share-job-button";
import { JOB_ROLE_ICONS } from "@/lib/job-role-icons";
import { formatJobDate, formatMoney, formatTimeRange } from "@/lib/format";

/**
 * Detalhe da vaga, igual para vaga de fixture e vaga publicada na
 * demonstração — o dado vem da mesma `getJobBySlug()`, mudando só quem a
 * chama (servidor em modo live, navegador em modo mock).
 */
export function JobDetailView({
  job,
  myApplication,
  workerName,
  isWorker,
}: {
  job: JobPost;
  myApplication: Application | null;
  workerName: string;
  isWorker: boolean;
}) {
  const RoleIcon = JOB_ROLE_ICONS[job.role];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <span className="bg-secondary text-secondary-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium">
          <RoleIcon aria-hidden="true" className="size-3.5 shrink-0" />
          {JOB_ROLE_LABELS[job.role]}
        </span>
        <ShareJobButton job={job} />
      </div>

      <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
        {job.title}
      </h1>

      <dl className="text-muted-foreground mt-4 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
          <dt className="sr-only">Data</dt>
          <dd className="first-letter:uppercase">{formatJobDate(job.date)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Clock aria-hidden="true" className="size-4 shrink-0" />
          <dt className="sr-only">Horário</dt>
          <dd>{formatTimeRange(job.startTime, job.endTime)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <MapPin aria-hidden="true" className="size-4 shrink-0" />
          <dt className="sr-only">Local</dt>
          <dd>
            {job.address} — {job.neighborhood}, {job.city}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <Users aria-hidden="true" className="size-4 shrink-0" />
          <dt className="sr-only">Vagas</dt>
          <dd>{job.vacancies === 1 ? "1 vaga" : `${job.vacancies} vagas`}</dd>
        </div>
      </dl>

      <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
        <span className="text-primary text-2xl font-bold">
          {formatMoney(job.payAmount)}
        </span>
        <span className="text-muted-foreground text-xs">
          valor informado pela empresa
        </span>
      </p>
      {job.payNote && (
        <p className="text-muted-foreground mt-1 text-sm">{job.payNote}</p>
      )}

      <div className="mt-6">
        <h2 className="text-lg font-bold tracking-tight">Descrição</h2>
        <p className="text-muted-foreground mt-2 whitespace-pre-line text-sm">
          {job.description}
        </p>
      </div>

      {job.requirements && (
        <div className="mt-6">
          <h2 className="text-lg font-bold tracking-tight">Requisitos</h2>
          <p className="text-muted-foreground mt-2 whitespace-pre-line text-sm">
            {job.requirements}
          </p>
        </div>
      )}

      <div className="mt-8">
        <JobApplyPanel
          job={job}
          initialApplication={myApplication}
          workerName={workerName}
          isWorker={isWorker}
        />
      </div>
    </div>
  );
}

/** Espaço reservado enquanto a vaga carrega do localStorage (modo mock). */
export function JobDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8" aria-hidden="true">
      <div className="bg-muted h-6 w-32 animate-pulse rounded-md" />
      <div className="bg-muted mt-3 h-10 w-3/4 animate-pulse rounded" />
      <div className="bg-muted mt-6 h-28 animate-pulse rounded-xl" />
      <div className="bg-muted mt-6 h-32 animate-pulse rounded-xl" />
    </div>
  );
}
