"use client";

import { Share2 } from "lucide-react";
import type { PublicJobPost } from "@extra/shared/types/job";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import {
  formatJobWeekdayAndDate,
  formatMoney,
  formatTimeRange,
} from "@/lib/format";
import { SITE_URL } from "@/lib/site";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function buildShareMessage(job: PublicJobPost): string {
  const { weekday, shortDate } = formatJobWeekdayAndDate(job.startsAt);
  const vacancies = job.vacancies === 1 ? "1 vaga" : `${job.vacancies} vagas`;

  return [
    `Vaga de ${JOB_ROLE_LABELS[job.role]} — ${job.title}`,
    `${weekday} ${shortDate}, ${formatTimeRange(job.startsAt, job.endsAt)} — ${formatMoney(job.payAmount)}`,
    vacancies,
    `${SITE_URL}/vagas/${job.citySlug}/${job.slug}`,
  ].join("\n");
}

/**
 * navigator.share abre o seletor nativo (WhatsApp já vem como opção nele);
 * sem suporte (a maioria dos desktops), cai direto no wa.me — mesmo texto
 * nos dois casos, porque o link já vai embutido na última linha.
 *
 * `compact`: só o ícone, para o card da listagem (job-card.tsx) — ali o botão
 * fica fora do `<Link>` que cobre o card inteiro (botão dentro de link não é
 * HTML válido e ainda navegaria no clique), então precisa ser pequeno o
 * bastante para não brigar de espaço com o resto do cartão.
 */
export function ShareJobButton({
  job,
  compact = false,
}: {
  job: PublicJobPost;
  compact?: boolean;
}) {
  const share = async () => {
    const text = buildShareMessage(job);

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Vaga de ${JOB_ROLE_LABELS[job.role]} — ${job.title}`,
          text,
        });
      } catch {
        // Cancelou o seletor nativo — não abre o wa.me por baixo.
      }
      return;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <button
      type="button"
      onClick={share}
      aria-label={compact ? "Compartilhar vaga" : undefined}
      className={cn(
        buttonVariants({
          variant: "outline",
          size: compact ? "icon-sm" : "sm",
        }),
        "shrink-0",
      )}
    >
      <Share2 aria-hidden="true" className="size-3.5" />
      {!compact && "Compartilhar"}
    </button>
  );
}
