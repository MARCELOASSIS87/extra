import Link from "next/link";
import { RefreshCw, SearchX, WifiOff } from "lucide-react";
import type { ApiResult, Paginated } from "@extra/shared/types/api";
import type { JobPost } from "@extra/shared/types/job";
import type { JobFiltersInput } from "@extra/shared/schemas/job";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import { JobCard } from "@/components/jobs/job-card";
import { JobListSkeleton } from "@/components/jobs/job-list-skeleton";
import { JobFilters } from "@/components/jobs/job-filters";
import { Pagination } from "@/components/jobs/pagination";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCalendarDate } from "@/lib/format";
import { cityLabel } from "@/lib/api/cities";
import { hasActiveFilters, jobsHref } from "@/lib/job-search";

/**
 * A listagem completa, sem saber de onde o dado veio — mesmo `ApiResult` que
 * `listJobs()` devolve, vindo do servidor (modo live) ou de um useEffect
 * (modo mock). `null` é "ainda carregando".
 */
export function JobsPageView({
  result,
  neighborhoods,
  filters,
  today,
  defaultCityIds,
}: {
  result: ApiResult<Paginated<JobPost>> | null;
  neighborhoods: string[] | null;
  filters: JobFiltersInput;
  today: string;
  defaultCityIds: string[];
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
        Vagas abertas
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Você se candidata e combina o resto direto com a empresa.
      </p>

      <div className="mt-6">
        <JobFilters
          filters={filters}
          neighborhoods={neighborhoods}
          today={today}
          defaultCityIds={defaultCityIds}
        />
      </div>

      <div className="mt-6">
        {result === null ? (
          <JobListSkeleton count={4} />
        ) : !result.ok ? (
          <ErrorState />
        ) : result.data.items.length === 0 && result.data.total > 0 ? (
          // Página além da última (link velho, URL editada à mão): existe vaga,
          // só não nesta página. Dizer "nenhuma vaga" aqui seria mentira.
          <OutOfRangeState filters={filters} />
        ) : result.data.items.length === 0 ? (
          <EmptyState
            role={filters.role}
            cityId={filters.cityId}
            date={filters.date}
            neighborhood={filters.neighborhood}
            filtered={hasActiveFilters(filters)}
          />
        ) : (
          <>
            <p className="text-muted-foreground text-sm" aria-live="polite">
              {result.data.total === 1
                ? "1 vaga encontrada"
                : `${result.data.total} vagas encontradas`}
            </p>

            <ul className="mt-3 grid gap-3">
              {result.data.items.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </ul>

            <Pagination
              filters={filters}
              page={result.data.page}
              pageSize={result.data.pageSize}
              total={result.data.total}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center">
      <WifiOff
        aria-hidden="true"
        className="text-muted-foreground/60 mx-auto size-8"
      />
      <p className="mt-3 font-medium">Não foi possível carregar as vagas.</p>
      <p className="text-muted-foreground mt-1 text-sm">
        Pode ter sido a conexão. Tente de novo em alguns segundos.
      </p>
      <Link
        href="/vagas"
        className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-11")}
      >
        <RefreshCw aria-hidden="true" className="size-4" />
        Tentar de novo
      </Link>
    </div>
  );
}

function OutOfRangeState({ filters }: { filters: JobFiltersInput }) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center">
      <p className="font-medium">Esta página não tem vagas.</p>
      <p className="text-muted-foreground mt-1 text-sm">
        Existem vagas abertas, mas não nesta página.
      </p>
      <Link
        href={jobsHref(filters, { page: 1 })}
        className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-11")}
      >
        Voltar para a primeira página
      </Link>
    </div>
  );
}

function EmptyState({
  role,
  cityId,
  date,
  neighborhood,
  filtered,
}: {
  role?: string;
  cityId?: string;
  date?: string;
  neighborhood?: string;
  filtered: boolean;
}) {
  // Repete o que foi buscado: sem isso o vazio parece defeito, não resultado.
  const applied = [
    role ? JOB_ROLE_LABELS[role as keyof typeof JOB_ROLE_LABELS] : null,
    cityId ? cityLabel(cityId) : null,
    neighborhood,
    date ? formatCalendarDate(date) : null,
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-dashed p-6 text-center">
      <SearchX
        aria-hidden="true"
        className="text-muted-foreground/50 mx-auto size-12"
      />
      <p className="mt-3 font-medium">
        {filtered
          ? "Nenhuma vaga com esses filtros."
          : "Nenhuma vaga aberta agora."}
      </p>
      {applied.length > 0 && (
        <p className="text-muted-foreground mt-1 text-sm">
          Você buscou por {applied.join(", ")}.
        </p>
      )}
      <p className="text-muted-foreground mt-1 text-sm">
        Vagas novas aparecem todo dia. Cadastre-se para ser avisado quando
        surgir uma da sua função.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {filtered && (
          <Link
            href={jobsHref({})}
            className={cn(buttonVariants({ variant: "outline" }), "h-11")}
          >
            Ver todas as vagas
          </Link>
        )}
        <Link
          href="/cadastro/trabalhador"
          className={cn(buttonVariants(), "h-11")}
        >
          Quero trabalhar
        </Link>
      </div>
    </div>
  );
}
