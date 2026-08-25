import Link from "next/link";
import { Briefcase, RefreshCw, UserRound, WifiOff } from "lucide-react";
import type { ApiResult } from "@extra/shared/types/api";
import type { Application } from "@extra/shared/types/application";
import type { Company } from "@extra/shared/types/company";
import type { JobPost } from "@extra/shared/types/job";
import type {
  WorkerApplicantProfile,
  WorkerPublicProfile,
} from "@extra/shared/types/worker";
import { AttendancePendingList } from "@/components/company/attendance-pending-list";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatJobDate } from "@/lib/format";

/** O que o painel busca — as quatro seções são independentes entre si. */
export interface CompanyPanelData {
  company: ApiResult<Company | null>;
  jobs: ApiResult<JobPost[]>;
  applicants: ApiResult<
    { application: Application; job: JobPost; worker: WorkerPublicProfile }[]
  >;
  pending: ApiResult<
    {
      job: JobPost;
      worker: WorkerApplicantProfile;
      shortCode: string;
      workerPhone: string;
    }[]
  >;
}

/** `data: null` é "ainda carregando" — só acontece em modo mock. */
export function CompanyPanelView({ data }: { data: CompanyPanelData | null }) {
  const openJobs =
    data?.jobs.ok === true
      ? data.jobs.data.filter((job) => job.status === "open")
      : [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            {data?.company.ok && data.company.data
              ? data.company.data.tradeName
              : "Painel da empresa"}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Suas vagas abertas, os candidatos novos e a presença pendente.
          </p>
        </div>
        <Link href="/empresa/vagas/nova" className={buttonVariants()}>
          Publicar vaga
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-bold tracking-tight">Vagas abertas</h2>
        <div className="mt-3">
          {data === null ? (
            <LoadingState />
          ) : !data.jobs.ok ? (
            <ErrorState message="Não foi possível carregar suas vagas." />
          ) : openJobs.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Nenhuma vaga aberta agora."
              description="Publique uma vaga para começar a receber candidatos."
            />
          ) : (
            <ul className="grid gap-3">
              {openJobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/empresa/vagas/${job.id}/candidatos`}
                    className="hover:border-primary/30 block rounded-xl border p-4 shadow-sm transition-colors duration-150"
                  >
                    <h3 className="text-balance font-bold leading-snug">
                      {job.title}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-sm first-letter:uppercase">
                      {formatJobDate(job.startsAt)}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {job.applicationsCount === 1
                        ? "1 candidato"
                        : `${job.applicationsCount} candidatos`}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold tracking-tight">Candidatos novos</h2>
        <div className="mt-3">
          {data === null ? (
            <LoadingState />
          ) : !data.applicants.ok ? (
            <ErrorState message="Não foi possível carregar os candidatos." />
          ) : data.applicants.data.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title="Nenhum candidato novo."
              description="Quando alguém se candidatar, aparece aqui."
            />
          ) : (
            <ul className="grid gap-3">
              {data.applicants.data.map(({ application, job, worker }) => (
                <li
                  key={application.id}
                  className="rounded-xl border p-4 shadow-sm"
                >
                  <p className="truncate font-medium">
                    {worker.firstName} {worker.lastNameInitial}
                  </p>
                  <p className="text-muted-foreground mt-0.5 truncate text-sm">
                    {job.title} · candidatou-se em{" "}
                    {formatJobDate(application.appliedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold tracking-tight">
          Pendências de marcação de presença
        </h2>
        {data === null ? (
          <div className="mt-3">
            <LoadingState />
          </div>
        ) : !data.pending.ok ? (
          <ErrorState message="Não foi possível carregar as pendências." />
        ) : (
          <AttendancePendingList items={data.pending.data} />
        )}
      </section>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-3" aria-hidden="true">
      {[0, 1].map((key) => (
        <div
          key={key}
          className="bg-muted h-24 animate-pulse rounded-xl border"
        />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center">
      <WifiOff
        aria-hidden="true"
        className="text-muted-foreground/60 mx-auto size-8"
      />
      <p className="mt-3 font-medium">{message}</p>
      <p className="text-muted-foreground mt-1 text-sm">
        Pode ter sido a conexão. Tente de novo em alguns segundos.
      </p>
      <Link
        href="/empresa"
        className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
      >
        <RefreshCw aria-hidden="true" className="size-4" />
        Tentar de novo
      </Link>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Briefcase;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center">
      <Icon
        aria-hidden="true"
        className="text-muted-foreground/50 mx-auto size-10"
      />
      <p className="mt-3 font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 text-sm">{description}</p>
    </div>
  );
}
