import Link from "next/link";
import { CalendarClock, ClipboardList, SearchX, WifiOff } from "lucide-react";
import type { ApiResult, Paginated } from "@extra/shared/types/api";
import type {
  Application,
  ApplicationStatus,
} from "@extra/shared/types/application";
import type { JobPost } from "@extra/shared/types/job";
import type { Worker } from "@extra/shared/types/worker";
import { ConfirmApplicationButton } from "@/components/home/confirm-application-button";
import { JobCard } from "@/components/jobs/job-card";
import { JobListSkeleton } from "@/components/jobs/job-list-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { formatJobDate, formatTimeRange } from "@/lib/format";
import { cn } from "@/lib/utils";

export type WorkerHomeData = {
  worker: ApiResult<Worker | null>;
  applications: ApiResult<{ application: Application; job: JobPost }[]>;
  jobs: ApiResult<Paginated<JobPost>>;
};

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: "Candidatura enviada",
  confirmed: "Presença confirmada",
  withdrawn: "Candidatura retirada",
  no_response: "Sem resposta",
};

/** `date` é data pura: ancorar ao meio-dia UTC evita o "volta um dia". */
const nextDay = (date: string) => {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
};

/**
 * A home de quem já entrou como trabalhador: nada de herói nem de "Quero
 * trabalhar" — quem já se cadastrou não precisa mais ser convertido. A
 * confirmação de véspera (§16.3) vem antes de tudo, porque é a única coisa
 * aqui com hora para acontecer.
 *
 * Igual à `HomeView`, não sabe de onde o dado veio: `data: null` é "ainda
 * carregando", o que só acontece no modo mock (estado no localStorage).
 */
export function WorkerHomeView({
  data,
  today,
}: {
  data: WorkerHomeData | null;
  today: string;
}) {
  const worker = data?.worker.ok ? data.worker.data : null;
  const firstName = worker?.fullName.split(" ")[0] ?? "";

  const applications =
    data && data.applications.ok ? data.applications.data : null;
  const tomorrow = applications ? nextDay(today) : "";

  const pending = applications?.filter(
    ({ application, job }) =>
      job.date === tomorrow &&
      application.status !== "withdrawn" &&
      application.confirmedAt === null,
  );
  const active = applications?.filter(
    ({ application, job }) =>
      application.status !== "withdrawn" && job.date >= today,
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">
        {firstName ? `Oi, ${firstName}.` : "Oi."}
      </h1>

      <section className="mt-6">
        <h2 className="sr-only">Confirmação de véspera</h2>
        {data === null ? (
          <div className="bg-muted h-20 animate-pulse rounded-xl border" />
        ) : !data.applications.ok ? (
          <ErrorLine message="Não foi possível carregar suas candidaturas." />
        ) : pending && pending.length > 0 ? (
          <ul className="grid gap-3">
            {pending.map(({ application, job }) => (
              <li
                key={application.id}
                className="border-primary/40 bg-primary/5 rounded-xl border p-4"
              >
                <p className="text-primary flex items-center gap-2 text-sm font-semibold">
                  <CalendarClock aria-hidden="true" className="size-4" />
                  Amanhã: confirme se você vai
                </p>
                <Link
                  href={`/vagas/${job.slug}`}
                  className="mt-2 block text-lg font-bold leading-snug tracking-tight underline-offset-4 hover:underline"
                >
                  {job.title}
                </Link>
                <p className="text-muted-foreground mt-1 text-sm first-letter:uppercase">
                  {formatJobDate(job.date)} ·{" "}
                  {formatTimeRange(job.startTime, job.endTime)} ·{" "}
                  {job.neighborhood}
                </p>
                <ConfirmApplicationButton applicationId={application.id} />
                <p className="text-muted-foreground mt-2 text-xs">
                  Não confirmar não gera falta. É só um aviso para a empresa se
                  organizar.
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
            Nada para confirmar agora. Quando uma vaga sua for no dia seguinte,
            ela aparece aqui em primeiro lugar.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">Vagas para você</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Abertas nas funções e na cidade do seu perfil.
        </p>

        <div className="mt-4">
          {data === null ? (
            <JobListSkeleton />
          ) : !data.jobs.ok ? (
            <ErrorLine message="Não foi possível carregar as vagas." />
          ) : data.jobs.data.items.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <SearchX
                aria-hidden="true"
                className="text-muted-foreground/50 mx-auto size-10"
              />
              <p className="mt-3 font-medium">
                Nenhuma vaga aberta nas suas funções agora.
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Vagas novas aparecem todo dia. Avisamos assim que surgir uma da
                sua função.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3">
              {data.jobs.data.items.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4">
          <Link
            href="/vagas"
            className={cn(buttonVariants({ variant: "outline" }), "h-11")}
          >
            Ver todas as vagas
          </Link>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">
          Suas candidaturas ativas
        </h2>

        <div className="mt-4">
          {data === null ? (
            <div className="bg-muted h-24 animate-pulse rounded-xl border" />
          ) : !data.applications.ok ? (
            <ErrorLine message="Não foi possível carregar suas candidaturas." />
          ) : active && active.length > 0 ? (
            <ul className="grid gap-3">
              {active.map(({ application, job }) => (
                <li key={application.id} className="min-w-0 rounded-xl border">
                  <Link
                    href={`/vagas/${job.slug}`}
                    className="hover:border-primary/30 focus-visible:ring-ring block rounded-xl p-4 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
                  >
                    <p className="font-bold leading-snug">{job.title}</p>
                    <p className="text-muted-foreground mt-1 text-sm first-letter:uppercase">
                      {formatJobDate(job.date)} ·{" "}
                      {formatTimeRange(job.startTime, job.endTime)}
                    </p>
                    <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className="bg-secondary text-secondary-foreground rounded-md px-2 py-1 font-medium">
                        {STATUS_LABELS[application.status]}
                      </span>
                      <span>Código {application.shortCode}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <ClipboardList
                aria-hidden="true"
                className="text-muted-foreground/50 mx-auto size-10"
              />
              <p className="mt-3 font-medium">
                Você ainda não tem candidatura ativa.
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Toque em uma vaga acima e depois em &ldquo;Quero essa
                vaga&rdquo;. Se a empresa escolher você, ela chama no seu
                WhatsApp.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p className="text-muted-foreground flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm">
      <WifiOff aria-hidden="true" className="size-4 shrink-0" />
      {message} Pode ter sido a conexão — recarregue a página.
    </p>
  );
}
