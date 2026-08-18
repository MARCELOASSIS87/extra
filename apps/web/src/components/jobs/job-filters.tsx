"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { JobRole } from "@extra/shared/types/job";
import type { JobFiltersInput } from "@extra/shared/schemas/job";
import {
  FilterSheet,
  type FilterOption,
} from "@/components/filters/filter-sheet";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveRole } from "@/lib/filter-preferences";
import { hasActiveFilters, jobsHref, JOB_SEARCH_PARAM } from "@/lib/job-search";

/**
 * Os três filtros aplicam na hora, sem botão de confirmar: cada escolha vira
 * uma URL própria, então o voltar do Android desfaz filtro por filtro.
 */
export function JobFilters({
  filters,
  roleOptions,
  neighborhoods,
  today,
}: {
  filters: JobFiltersInput;
  roleOptions: readonly FilterOption<JobRole>[];
  /** `null` quando a busca de bairros falhou — o resto do filtro continua de pé. */
  neighborhoods: string[] | null;
  today: string;
}) {
  const router = useRouter();

  // Trocar de filtro sempre volta para a primeira página.
  const apply = (patch: Partial<JobFiltersInput>) =>
    router.push(jobsHref({ ...filters, ...patch, page: undefined }), {
      scroll: false,
    });

  return (
    <div className="bg-muted/40 rounded-lg border p-4">
      <h2 className="text-base font-semibold">Filtrar vagas</h2>

      <div className="mt-4 grid gap-3">
        <FilterSheet
          label="Função"
          value={filters.role ?? null}
          options={roleOptions}
          onChange={(role) => {
            saveRole(role);
            apply({ role: role ?? undefined });
          }}
          allOptionLabel="Todas as funções"
          emptyLabel="Todas"
        />

        {neighborhoods !== null && (
          <FilterSheet
            label="Bairro"
            value={filters.neighborhood ?? null}
            options={neighborhoods.map((name) => ({
              value: name,
              label: name,
            }))}
            onChange={(neighborhood) =>
              apply({ neighborhood: neighborhood ?? undefined })
            }
            allOptionLabel="Todos os bairros"
            emptyLabel="Todos"
          />
        )}

        <div className="grid gap-1.5">
          <label htmlFor="filtro-data" className="text-sm font-medium">
            Data
          </label>
          {/* Campo de data nativo: o Android já traz o calendário dele, em
              português, sem nenhuma biblioteca. */}
          <input
            id="filtro-data"
            type="date"
            name={JOB_SEARCH_PARAM.date}
            value={filters.date ?? ""}
            min={today}
            onChange={(event) =>
              apply({ date: event.target.value || undefined })
            }
            className="border-input bg-background focus-visible:ring-ring h-12 w-full rounded-lg border px-4 text-sm focus-visible:outline-none focus-visible:ring-2"
          />
        </div>
      </div>

      {hasActiveFilters(filters) && (
        <Link
          href={jobsHref({})}
          className={cn(buttonVariants({ variant: "ghost" }), "mt-3 h-11")}
        >
          Limpar filtros
        </Link>
      )}
    </div>
  );
}
