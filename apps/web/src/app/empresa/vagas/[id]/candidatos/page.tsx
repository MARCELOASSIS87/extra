import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, UserRound, WifiOff } from "lucide-react";
import { listMyCompanyJobs } from "@/lib/api/companies";
import { listJobCandidates } from "@/lib/api/applications";
import { WorkerAttendanceSummary } from "@/components/company/worker-attendance-summary";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Candidatos da vaga",
};

export default async function JobCandidatesPage({
  params,
}: PageProps<"/empresa/vagas/[id]/candidatos">) {
  const { id } = await params;

  // listJobCandidates já confere que a vaga é da empresa logada; a busca
  // aqui só serve para exibir o título no topo da tela.
  const [jobsResult, candidatesResult] = await Promise.all([
    listMyCompanyJobs(),
    listJobCandidates(id),
  ]);

  const job = jobsResult.ok
    ? jobsResult.data.find((item) => item.id === id)
    : undefined;
  if (jobsResult.ok && !job) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
        {job ? job.title : "Candidatos da vaga"}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Quem se candidatou, com o código para casar a conversa do WhatsApp.
      </p>

      <div className="mt-6">
        {!candidatesResult.ok ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <WifiOff
              aria-hidden="true"
              className="text-muted-foreground/60 mx-auto size-8"
            />
            <p className="mt-3 font-medium">
              Não foi possível carregar os candidatos.
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Pode ter sido a conexão. Tente de novo em alguns segundos.
            </p>
          </div>
        ) : candidatesResult.data.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <UserRound
              aria-hidden="true"
              className="text-muted-foreground/50 mx-auto size-10"
            />
            <p className="mt-3 font-medium">Nenhum candidato ainda.</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Quando alguém se candidatar, aparece aqui.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {candidatesResult.data.map(({ application, worker, workerPhone }) => (
              <li key={application.id} className="rounded-xl border p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/empresa/vagas/${id}/candidatos/${worker.id}`}
                    className="min-w-0 truncate font-medium hover:underline"
                  >
                    {worker.firstName} {worker.lastNameInitial}
                  </Link>
                  <span className="bg-secondary text-secondary-foreground shrink-0 rounded-md px-2 py-1 text-xs font-medium">
                    Código {application.shortCode}
                  </span>
                </div>
                <WorkerAttendanceSummary worker={worker} />
                <p className="text-muted-foreground mt-1 text-sm">
                  {worker.neighborhood}
                  {worker.experience && ` · ${worker.experience}`}
                </p>

                <a
                  href={`https://wa.me/${workerPhone.replace(/^\+/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "mt-3",
                  )}
                >
                  <MessageCircle aria-hidden="true" className="size-3.5" />
                  Falar no WhatsApp
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
