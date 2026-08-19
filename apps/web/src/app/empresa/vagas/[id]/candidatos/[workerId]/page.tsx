import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import { listJobCandidates } from "@/lib/api/applications";
import { WorkerAttendanceSummary } from "@/components/company/worker-attendance-summary";
import { buttonVariants } from "@/components/ui/button";
import { formatJobDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Perfil do candidato",
};

/**
 * Perfil público do trabalhador visto pela empresa — só existe para quem se
 * candidatou a esta vaga (listJobCandidates já confere que a vaga é da
 * empresa logada). Mesmo WorkerPublicProfile do §16.5: sem CPF, sem data de
 * nascimento.
 */
export default async function JobCandidateProfilePage({
  params,
}: PageProps<"/empresa/vagas/[id]/candidatos/[workerId]">) {
  const { id, workerId } = await params;

  const result = await listJobCandidates(id);
  const candidate = result.ok
    ? result.data.find((item) => item.worker.id === workerId)
    : undefined;
  if (!candidate) notFound();

  const { application, worker, workerPhone } = candidate;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          {worker.firstName} {worker.lastNameInitial}
        </h1>
        <span className="bg-secondary text-secondary-foreground shrink-0 rounded-md px-2 py-1 text-xs font-medium">
          Código {application.shortCode}
        </span>
      </div>

      <WorkerAttendanceSummary worker={worker} />

      <p className="text-muted-foreground mt-3 text-sm">
        {worker.neighborhood} · perfil desde{" "}
        {formatJobDate(worker.memberSince.slice(0, 10))}
      </p>

      <p className="mt-3 flex flex-wrap gap-1.5">
        {worker.roles.map((role) => (
          <span
            key={role}
            className="bg-secondary text-secondary-foreground rounded-md px-2 py-1 text-xs font-medium"
          >
            {JOB_ROLE_LABELS[role]}
          </span>
        ))}
      </p>

      {worker.experience && (
        <div className="mt-6">
          <h2 className="text-lg font-bold tracking-tight">Experiência</h2>
          <p className="text-muted-foreground mt-2 whitespace-pre-line text-sm">
            {worker.experience}
          </p>
        </div>
      )}

      <a
        href={`https://wa.me/${workerPhone.replace(/^\+/, "")}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants(), "mt-8")}
      >
        <MessageCircle aria-hidden="true" className="size-4" />
        Falar no WhatsApp
      </a>
    </div>
  );
}
