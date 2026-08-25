"use client";

import { useState } from "react";
import { Check, MessageCircle } from "lucide-react";
import type { JobPost } from "@extra/shared/types/job";
import { markApplicationContacted } from "@/lib/api/applications";
import { buttonVariants } from "@/components/ui/button";
import { saoPauloTime } from "@extra/shared/lib/datetime";
import { formatJobWeekdayAndDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Mensagem do §16.5: diz quem está chamando, qual vaga é e carimba o
 * `shortCode` que casa a conversa do WhatsApp com a candidatura.
 */
function buildMessage(
  job: JobPost,
  workerFirstName: string,
  companyName: string,
  shortCode: string,
) {
  const { weekday, shortDate } = formatJobWeekdayAndDate(job.startsAt);

  return [
    `Oi ${workerFirstName}! Aqui é ${companyName}.`,
    `Vi sua candidatura para ${job.title}, ${weekday} ${shortDate} às ${saoPauloTime(job.startsAt)} — ${formatMoney(job.payAmount)}.`,
    `Código: ${shortCode}`,
    `— via extraqui.com.br`,
  ].join("\n");
}

/**
 * Direção única do §16.5: só a empresa inicia o contato. O clique é o ato de
 * escolher — por isso grava `contactedAt` antes de abrir o WhatsApp, e é esse
 * carimbo que alimenta a marcação de presença (§16.7).
 *
 * O telefone chega por prop mas nunca é renderizado: vai só para o `wa.me`.
 */
export function ContactCandidateButton({
  applicationId,
  workerPhone,
  workerFirstName,
  companyName,
  job,
  shortCode,
  contactedAt,
  size = "sm",
  className,
}: {
  applicationId: string;
  workerPhone: string;
  workerFirstName: string;
  companyName: string;
  job: JobPost;
  shortCode: string;
  contactedAt: string | null;
  size?: "sm" | "lg";
  className?: string;
}) {
  const [contacted, setContacted] = useState(contactedAt !== null);

  const contact = () => {
    void markApplicationContacted(applicationId);
    setContacted(true);

    const message = buildMessage(job, workerFirstName, companyName, shortCode);
    window.open(
      `https://wa.me/${workerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={contact}
        className={cn(buttonVariants({ size }), size === "lg" && "h-12 w-full")}
      >
        <MessageCircle aria-hidden="true" className="size-3.5" />
        Falar no WhatsApp
      </button>
      {contacted && (
        <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
          <Check aria-hidden="true" className="size-3.5" />
          Você já chamou esta pessoa.
        </p>
      )}
    </div>
  );
}
