import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import { getJobBySlug } from "@/lib/api/jobs";
import { listMyApplications } from "@/lib/api/applications";
import { getMyWorkerProfile } from "@/lib/api/workers";
import { getSessionRole } from "@/lib/api/session";
import { JobApplyPanel } from "@/components/jobs/job-apply-panel";
import { JOB_ROLE_ICONS } from "@/lib/job-role-icons";
import { formatJobDate, formatMoney, formatTimeRange } from "@/lib/format";

export async function generateMetadata({
  params,
}: PageProps<"/vagas/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const result = await getJobBySlug(slug);
  if (!result.ok || !result.data) return {};
  return { title: result.data.title };
}

export default async function JobDetailPage({
  params,
}: PageProps<"/vagas/[slug]">) {
  const { slug } = await params;
  const result = await getJobBySlug(slug);
  if (!result.ok || !result.data) notFound();
  const job = result.data;

  // Em paralelo: se a pessoa já se candidatou, o nome dela e o papel da
  // sessão não dependem um do outro.
  const [applicationsResult, workerResult, role] = await Promise.all([
    listMyApplications(),
    getMyWorkerProfile(),
    getSessionRole(),
  ]);

  const myApplication = applicationsResult.ok
    ? (applicationsResult.data.find(
        (item) => item.jobPostId === job.id && item.status !== "withdrawn",
      ) ?? null)
    : null;

  const workerName =
    workerResult.ok && workerResult.data ? workerResult.data.fullName : "";

  const RoleIcon = JOB_ROLE_ICONS[job.role];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <span className="bg-secondary text-secondary-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium">
        <RoleIcon aria-hidden="true" className="size-3.5 shrink-0" />
        {JOB_ROLE_LABELS[job.role]}
      </span>

      <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
        {job.title}
      </h1>

      <dl className="text-muted-foreground mt-4 space-y-2 text-sm">
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
          isWorker={role === "worker"}
        />
      </div>
    </div>
  );
}
