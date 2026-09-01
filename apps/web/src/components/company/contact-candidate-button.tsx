"use client";

import { useState } from "react";
import { Check, MessageCircle } from "lucide-react";
import type { PublicJobPost } from "@extra/shared/types/job";
import { getApplicationContact } from "@/lib/api/applications";
import { buttonVariants } from "@/components/ui/button";
import { saoPauloTime } from "@extra/shared/lib/datetime";
import { formatJobWeekdayAndDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Mensagem do §16.5: diz quem está chamando, qual vaga é e carimba o
 * `shortCode` que casa a conversa do WhatsApp com a candidatura.
 */
function buildMessage(
  job: PublicJobPost,
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
 * Direção única do §16.5: só a empresa inicia o contato.
 *
 * O telefone NÃO chega por prop. Ele é pedido no clique, um por vez, e é o
 * próprio pedido que grava `contactedAt` — o clique é o ato de escolher. A
 * ordem importa: pede, recebe o número, abre o WhatsApp. Se o pedido falhar,
 * nada abre, porque não há número nenhum guardado na tela para abrir.
 *
 * O número nunca vira texto renderizado: vai do retorno da chamada direto
 * para o `wa.me`. Número escrito na tela é número colado no grupo.
 */
export function ContactCandidateButton({
  applicationId,
  workerFirstName,
  companyName,
  job,
  shortCode,
  contactedAt,
  size = "sm",
  className,
}: {
  applicationId: string;
  workerFirstName: string;
  companyName: string;
  job: PublicJobPost;
  shortCode: string;
  contactedAt: string | null;
  size?: "sm" | "lg";
  className?: string;
}) {
  const [contacted, setContacted] = useState(contactedAt !== null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const contact = async () => {
    setPending(true);
    setFailed(false);

    const result = await getApplicationContact(applicationId);
    setPending(false);

    if (!result.ok) {
      setFailed(true);
      return;
    }

    setContacted(true);
    const message = buildMessage(job, workerFirstName, companyName, shortCode);
    window.open(
      `https://wa.me/${result.data.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void contact()}
        disabled={pending}
        className={cn(buttonVariants({ size }), size === "lg" && "h-12 w-full")}
      >
        <MessageCircle aria-hidden="true" className="size-3.5" />
        {pending ? "Abrindo…" : "Falar no WhatsApp"}
      </button>
      {failed && (
        <p className="text-destructive mt-2 text-xs">
          Não foi possível abrir a conversa. Tente de novo.
        </p>
      )}
      {contacted && (
        <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
          <Check aria-hidden="true" className="size-3.5" />
          Você já chamou esta pessoa.
        </p>
      )}
    </div>
  );
}
