"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRound, WifiOff } from "lucide-react";
import type { ApiResult } from "@extra/shared/types/api";
import type { Company } from "@extra/shared/types/company";
import { listJobCandidates } from "@/lib/api/applications";
import { getMyCompany } from "@/lib/api/companies";
import { ContactCandidateButton } from "@/components/company/contact-candidate-button";
import { WorkerAttendanceSummary } from "@/components/company/worker-attendance-summary";

type Candidates = Awaited<ReturnType<typeof listJobCandidates>>;

/**
 * Área da empresa: sempre no navegador, sem caminho de servidor. A tela é
 * privada (nada a indexar) e, em modo mock, o estado mutável mora no
 * localStorage — renderizada no servidor, uma vaga publicada na demonstração
 * apareceria como inexistente.
 */
export function JobCandidatesClient({ jobId }: { jobId: string }) {
  const [state, setState] = useState<{
    result: Candidates;
    company: ApiResult<Company | null>;
  } | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([listJobCandidates(jobId), getMyCompany()]).then(
      ([result, company]) => {
        if (active) setState({ result, company });
      },
    );

    return () => {
      active = false;
    };
  }, [jobId]);

  if (!state) return <CandidatesSkeleton />;

  const { result, company } = state;
  if (!result.ok && ["job_not_found", "forbidden"].includes(result.error.code)) {
    notFound();
  }

  const companyName =
    company.ok && company.data ? company.data.tradeName : "";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
        {result.ok ? result.data.job.title : "Candidatos da vaga"}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Quem se candidatou, com o código para casar a conversa do WhatsApp.
        Quem chama é você.
      </p>

      <div className="mt-6">
        {!result.ok ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <WifiOff
              aria-hidden="true"
              className="text-muted-foreground/60 mx-auto size-8"
            />
            <p className="mt-3 font-medium">
              Não foi possível carregar os candidatos.
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Pode ter sido a conexão. Recarregue a página em alguns segundos.
            </p>
          </div>
        ) : result.data.candidates.length === 0 ? (
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
            {result.data.candidates.map(
              ({ application, worker, workerPhone }) => (
                // Link esticado: "Ver perfil completo" é um link de verdade,
                // e o `before` dele cobre o card inteiro — alvo grande, uma
                // mão, no ônibus. Envolver o card num <a> não dá: botão dentro
                // de link é HTML inválido. Quem é interativo fica fora do
                // <Link>, com `relative z-10` para ser pintado por cima da
                // camada e continuar clicável e alcançável pelo teclado.
                <li
                  key={application.id}
                  className="has-[a:focus-visible]:ring-ring group hover:border-primary/40 relative cursor-pointer rounded-xl border p-4 shadow-sm transition-all duration-150 hover:shadow-md has-[a:focus-visible]:ring-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate font-medium group-hover:underline">
                      {worker.fullName}
                    </p>
                    <span className="bg-secondary text-secondary-foreground shrink-0 rounded-md px-2 py-1 text-xs font-medium">
                      Código {application.shortCode}
                    </span>
                  </div>
                  <WorkerAttendanceSummary worker={worker} />
                  <p className="text-muted-foreground mt-1 text-sm">
                    {worker.neighborhood}, {worker.cityName}
                    {worker.experience && ` · ${worker.experience}`}
                  </p>

                  <div className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-2">
                    <ContactCandidateButton
                      applicationId={application.id}
                      workerPhone={workerPhone}
                      workerFirstName={worker.firstName}
                      companyName={companyName}
                      job={result.data.job}
                      shortCode={application.shortCode}
                      contactedAt={application.contactedAt}
                      className="relative z-10"
                    />
                    {/* Sem `truncate`/`overflow-hidden` aqui: o overflow do
                        próprio link recortaria o `before` de volta ao tamanho
                        do texto e o card deixaria de ser clicável. */}
                    <Link
                      href={`/empresa/vagas/${jobId}/candidatos/${worker.id}`}
                      className="text-muted-foreground hover:text-foreground focus-visible:outline-none inline-flex h-8 items-center gap-1 text-sm underline-offset-4 before:absolute before:inset-0 before:rounded-xl hover:underline"
                    >
                      Ver perfil completo
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function CandidatesSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8" aria-hidden="true">
      <div className="bg-muted h-10 w-3/4 animate-pulse rounded" />
      <div className="mt-6 grid gap-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="bg-muted h-32 animate-pulse rounded-xl border"
          />
        ))}
      </div>
    </div>
  );
}
