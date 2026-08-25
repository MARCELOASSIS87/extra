"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { VideoOff } from "lucide-react";
import type { ApiResult } from "@extra/shared/types/api";
import type { Company } from "@extra/shared/types/company";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import {
  PERIOD_LABELS,
  WEEKDAY_SHORT_LABELS,
} from "@extra/shared/constants/availability";
import { listJobCandidates } from "@/lib/api/applications";
import { getMyCompany } from "@/lib/api/companies";
import { AttendanceMarkButtons } from "@/components/company/attendance-mark-buttons";
import { ContactCandidateButton } from "@/components/company/contact-candidate-button";
import { formatAttendanceSummary, formatJobDate } from "@/lib/format";

type Candidates = Awaited<ReturnType<typeof listJobCandidates>>;

const chipClass =
  "bg-secondary text-secondary-foreground rounded-md px-2 py-1 text-xs font-medium";

/**
 * Perfil do candidato visto pela empresa daquela vaga (§16.5): sempre no
 * navegador, como o resto da área da empresa — tela privada, e em modo mock o
 * estado mutável mora no localStorage.
 *
 * `listJobCandidates` já garante as duas condições de acesso: a vaga é desta
 * empresa e esta pessoa tem candidatura ativa nela. O que chega aqui é
 * `WorkerApplicantProfile` — sem CPF e sem data de nascimento.
 */
export function CandidateProfileClient({
  jobId,
  workerId,
}: {
  jobId: string;
  workerId: string;
}) {
  const [state, setState] = useState<{
    result: Candidates;
    company: ApiResult<Company | null>;
    now: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([listJobCandidates(jobId), getMyCompany()]).then(
      ([result, company]) => {
        if (active) {
          setState({
            result,
            company,
            // Instante inteiro: o bico pode terminar às 2h da manhã.
            now: new Date().toISOString(),
          });
        }
      },
    );

    return () => {
      active = false;
    };
  }, [jobId]);

  if (!state) return <ProfileSkeleton />;

  const { result, company, now } = state;
  if (!result.ok) {
    if (["job_not_found", "forbidden"].includes(result.error.code)) notFound();
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          Não foi possível carregar o candidato. Pode ter sido a conexão —
          recarregue a página.
        </p>
      </div>
    );
  }

  const { job, candidates } = result.data;
  const candidate = candidates.find((item) => item.worker.id === workerId);
  if (!candidate) notFound();

  const { application, worker, workerPhone, presentWithCompany } = candidate;
  const summary = formatAttendanceSummary(worker.attendance);
  const companyName = company.ok && company.data ? company.data.tradeName : "";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      {/* O vídeo é o cartão de visitas do trabalhador: vem antes de tudo. */}
      {worker.introVideoUrl ? (
        // 9:16 porque é gravado no celular, na mão. Toca aqui mesmo: nada de
        // link ou download no meio do caminho de quem está escolhendo alguém.
        <video
          src={worker.introVideoUrl}
          poster={worker.introVideoPosterUrl ?? undefined}
          controls
          playsInline
          preload="metadata"
          className="aspect-[9/16] w-full rounded-xl border bg-black object-contain"
        />
      ) : (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <VideoOff
            aria-hidden="true"
            className="text-muted-foreground/50 mx-auto size-10"
          />
          <p className="mt-3 font-medium">
            {worker.firstName} ainda não gravou o vídeo de apresentação.
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            O vídeo é opcional no cadastro. O resto do perfil está abaixo.
          </p>
        </div>
      )}

      <h1 className="mt-6 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
        {worker.fullName}
      </h1>

      <p className="mt-3 flex flex-wrap gap-1.5">
        {worker.roles.map((role) => (
          <span key={role} className={chipClass}>
            {JOB_ROLE_LABELS[role]}
          </span>
        ))}
      </p>

      {worker.experience && (
        <p className="text-muted-foreground mt-3 whitespace-pre-line text-sm">
          {worker.experience}
        </p>
      )}

      <p className="text-muted-foreground mt-3 text-sm">
        {worker.neighborhood}, {worker.cityName}
      </p>

      <div className="mt-4">
        <h2 className="text-sm font-bold tracking-tight">Disponibilidade</h2>
        {worker.availability.length === 0 ? (
          <p className="text-muted-foreground mt-1 text-sm">
            Não informada no cadastro.
          </p>
        ) : (
          <p className="mt-1 flex flex-wrap gap-1.5">
            {worker.availability.map((slot) => (
              <span
                key={`${slot.weekday}-${slot.period}`}
                className={chipClass}
              >
                {WEEKDAY_SHORT_LABELS[slot.weekday]} ·{" "}
                {PERIOD_LABELS[slot.period]}
              </span>
            ))}
          </p>
        )}
      </div>

      {/* Número cru, sem estrela e sem cor de julgamento. Quem não tem
          histórico mostra "Novo por aqui", nunca "0 presenças". */}
      <p className="mt-6 text-sm font-medium">{summary ?? "Novo por aqui"}</p>
      <p className="text-muted-foreground mt-1 text-xs">
        Histórico informado pelas empresas.
      </p>

      {worker.hasCompleteProfile && (
        <p className="mt-2">
          <span className={chipClass}>Perfil completo</span>
        </p>
      )}

      {presentWithCompany > 0 && (
        <p className="mt-4 text-sm">
          Você já contratou {worker.firstName}{" "}
          {presentWithCompany === 1 ? "1 vez" : `${presentWithCompany} vezes`}.
        </p>
      )}

      <p className="text-muted-foreground mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span>No Extraqui desde {formatJobDate(worker.memberSince)}</span>
        <span className={chipClass}>Código {application.shortCode}</span>
      </p>

      <div className="mt-6">
        <ContactCandidateButton
          applicationId={application.id}
          workerPhone={workerPhone}
          workerFirstName={worker.firstName}
          companyName={companyName}
          job={job}
          shortCode={application.shortCode}
          contactedAt={application.contactedAt}
          size="lg"
        />
      </div>

      {job.endsAt < now && (
        <div className="mt-8 rounded-xl border p-4">
          <h2 className="font-bold tracking-tight">
            {worker.firstName} compareceu?
          </h2>
          <p className="text-muted-foreground mb-3 mt-1 text-sm">
            Marque uma vez só. &ldquo;Não chamei&rdquo; é neutro e não entra no
            histórico dela.
          </p>
          <AttendanceMarkButtons
            jobId={job.id}
            workerId={worker.id}
            initialStatus={candidate.attendanceStatus}
          />
        </div>
      )}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8" aria-hidden="true">
      <div className="bg-muted h-64 animate-pulse rounded-xl border" />
      <div className="bg-muted mt-6 h-10 w-2/3 animate-pulse rounded" />
      <div className="bg-muted mt-4 h-24 animate-pulse rounded-xl" />
      <div className="bg-muted mt-6 h-32 animate-pulse rounded-xl" />
    </div>
  );
}
