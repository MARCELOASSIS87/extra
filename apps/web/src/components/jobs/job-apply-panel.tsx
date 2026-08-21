"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import type { Application } from "@extra/shared/types/application";
import type { JobPost } from "@extra/shared/types/job";
import { applyToJob } from "@/lib/api/applications";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Direção única do §16.5: só a empresa inicia o contato. O trabalhador nunca
 * recebe o telefone da vaga e não tem botão de contato em momento nenhum —
 * se dezoito candidatos pudessem chamar, quem paga a assinatura receberia
 * dezoito mensagens de desconhecidos por anúncio e cancelaria.
 */
export function JobApplyPanel({
  job,
  initialApplication,
  isWorker,
}: {
  job: JobPost;
  initialApplication: Application | null;
  isWorker: boolean;
}) {
  const [application, setApplication] = useState(initialApplication);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    setIsApplying(true);
    setError(null);
    const result = await applyToJob(job.id);
    setIsApplying(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setApplication(result.data);
  };

  if (application && application.status !== "withdrawn") {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <CircleCheck
          aria-hidden="true"
          className="text-primary mx-auto size-8"
        />
        {/* Nunca "a empresa foi notificada": é promessa sobre terceiro. */}
        <p className="mt-3 font-medium">
          Candidatura enviada. Se a empresa escolher você, ela chama no seu
          WhatsApp.
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          Ela cita o código {application.shortCode} na mensagem.
        </p>
      </div>
    );
  }

  if (job.status !== "open") {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
        Esta vaga não está mais aberta.
      </p>
    );
  }

  if (job.applicationsCount >= job.maxApplications) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
        Esta vaga já tem candidatos suficientes.
      </p>
    );
  }

  if (!isWorker) {
    return (
      <Link
        href={`/cadastro/trabalhador?vaga=${job.slug}`}
        className={cn(buttonVariants({ size: "lg" }), "h-12 w-full")}
      >
        Quero essa vaga
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={isApplying}
        onClick={apply}
        className={cn(buttonVariants({ size: "lg" }), "h-12 w-full")}
      >
        {isApplying ? "Enviando..." : "Quero essa vaga"}
      </button>
      {error && (
        <p role="alert" className="text-destructive mt-3 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
