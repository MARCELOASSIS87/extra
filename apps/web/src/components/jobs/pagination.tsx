import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { JobFiltersInput } from "@extra/shared/schemas/job";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { jobsHref } from "@/lib/job-search";

/**
 * Anterior/próxima em vez de lista numerada: em 360px cabe, e o público chega
 * pela notificação, não navegando fundo na listagem.
 */
export function Pagination({
  filters,
  page,
  pageSize,
  total,
}: {
  filters: JobFiltersInput;
  page: number;
  pageSize: number;
  total: number;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (lastPage <= 1) return null;

  const previousHref = jobsHref(filters, { page: page - 1 });
  const nextHref = jobsHref(filters, { page: page + 1 });
  const linkClass = cn(buttonVariants({ variant: "outline" }), "h-11 gap-1");
  const disabledClass =
    "text-muted-foreground pointer-events-none inline-flex h-11 items-center gap-1 rounded-lg border px-3 text-sm opacity-50";

  return (
    <nav
      aria-label="Paginação das vagas"
      className="mt-6 flex items-center justify-between gap-3"
    >
      {page > 1 ? (
        <Link href={previousHref} rel="prev" className={linkClass}>
          <ChevronLeft aria-hidden="true" className="size-4" />
          Anterior
        </Link>
      ) : (
        <span className={disabledClass} aria-hidden="true">
          <ChevronLeft className="size-4" />
          Anterior
        </span>
      )}

      <p aria-live="polite" className="text-muted-foreground text-sm">
        Página {page} de {lastPage}
      </p>

      {page < lastPage ? (
        <Link href={nextHref} rel="next" className={linkClass}>
          Próxima
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      ) : (
        <span className={disabledClass} aria-hidden="true">
          Próxima
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
