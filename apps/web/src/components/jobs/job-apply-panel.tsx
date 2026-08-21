"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck, MessageCircle } from "lucide-react";
import type { Application } from "@extra/shared/types/application";
import type { JobPost } from "@extra/shared/types/job";
import { applyToJob, markApplicationContacted } from "@/lib/api/applications";
import { getJobContact } from "@/lib/api/jobs";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TIME_ZONE = "America/Sao_Paulo";

/**
 * Mensagem do §16.5: identifica quem é, casa a conversa com o `shortCode` e
 * carimba a marca no WhatsApp de quem contrata — três funções numa linha.
 */
function buildWhatsappMessage(
  job: JobPost,
  workerName: string,
  shortCode: string,
) {
  const jobDate = new Date(`${job.date}T12:00:00Z`);
  const dia = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    timeZone: TIME_ZONE,
  }).format(jobDate);
  const data = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: TIME_ZONE,
  }).format(jobDate);

  return [
    `Oi! Sou ${workerName}.`,
    `Me candidatei à vaga de ${job.title}, ${dia} ${data} às ${job.startTime}.`,
    `Código: ${shortCode}`,
    `— via extraqui.com.br`,
  ].join("\n");
}

/**
 * O telefone nunca chega ao servidor desta página: só é buscado no clique de
 * "Falar no WhatsApp", depois de candidatura ativa (§16.5).
 */
export function JobApplyPanel({
  job,
  initialApplication,
  workerName,
  isWorker,
}: {
  job: JobPost;
  initialApplication: Application | null;
  workerName: string;
  isWorker: boolean;
}) {
  const [application, setApplication] = useState(initialApplication);
  const [isApplying, setIsApplying] = useState(false);
  const [isOpeningWhatsapp, setIsOpeningWhatsapp] = useState(false);
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

  const openWhatsapp = async () => {
    if (!application) return;
    setIsOpeningWhatsapp(true);
    setError(null);

    const contactResult = await getJobContact(job.id);
    if (!contactResult.ok) {
      setIsOpeningWhatsapp(false);
      setError(contactResult.error.message);
      return;
    }

    void markApplicationContacted(application.id);

    const phone = contactResult.data.contactPhone.replace(/^\+/, "");
    const message = buildWhatsappMessage(
      job,
      workerName,
      application.shortCode,
    );
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
    setIsOpeningWhatsapp(false);
  };

  if (application && application.status !== "withdrawn") {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <CircleCheck
          aria-hidden="true"
          className="text-primary mx-auto size-8"
        />
        <p className="mt-3 font-medium">
          Candidatura registrada. Você aparece no painel da empresa. Chame no
          WhatsApp para combinar os detalhes.
        </p>
        <button
          type="button"
          disabled={isOpeningWhatsapp}
          onClick={openWhatsapp}
          className={cn(buttonVariants({ size: "lg" }), "mt-4 h-12 w-full")}
        >
          <MessageCircle aria-hidden="true" className="size-4" />
          Falar no WhatsApp
        </button>
        {error && (
          <p role="alert" className="text-destructive mt-3 text-xs">
            {error}
          </p>
        )}
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
