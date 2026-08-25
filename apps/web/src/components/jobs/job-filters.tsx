"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { JobFiltersInput } from "@extra/shared/schemas/job";
import { FilterSheet } from "@/components/filters/filter-sheet";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveRole } from "@/lib/filter-preferences";
import { hasActiveFilters, jobsHref, JOB_SEARCH_PARAM } from "@/lib/job-search";
import { ROLE_FILTER_OPTIONS } from "@/lib/job-role-icons";
import { cityLabel, listCities } from "@/lib/api/cities";

/**
 * Os quatro filtros aplicam na hora, sem botão de confirmar: cada escolha vira
 * uma URL própria, então o voltar do Android desfaz filtro por filtro.
 *
 * ROLE_FILTER_OPTIONS vem de um import interno, não de prop: cada opção
 * carrega um componente de ícone, e função não atravessa a fronteira
 * servidor→cliente como prop (ver comentário em role-filter-sheet.tsx).
 */
export function JobFilters({
  filters,
  neighborhoods,
  today,
  defaultCityIds,
}: {
  filters: JobFiltersInput;
  /** `null` quando a busca de bairros falhou — o resto do filtro continua de pé. */
  neighborhoods: string[] | null;
  today: string;
  /** Onde a listagem abre sem `?cidade=` na URL: as cidades assinadas. */
  defaultCityIds: string[];
}) {
  const router = useRouter();

  // Sem cidade na URL o seletor não diz "todas": diz onde a busca está
  // acontecendo de verdade, senão o resultado parece filtrado por engano.
  const defaultCityLabel =
    defaultCityIds.length === 1
      ? cityLabel(defaultCityIds[0])
      : `Minhas ${defaultCityIds.length} cidades`;

  // Trocar de filtro sempre volta para a primeira página.
  const apply = (patch: Partial<JobFiltersInput>) =>
    router.push(jobsHref({ ...filters, ...patch, page: undefined }), {
      scroll: false,
    });

  return (
    <div className="bg-muted/40 rounded-xl border p-4">
      <h2 className="text-base font-bold">Filtrar vagas</h2>

      <div className="mt-4 grid gap-3">
        {/* Cidade primeiro: é o filtro que muda mais resultado de uma vez, e
            sem ele na URL a listagem já abre nas cidades assinadas (§16.2). */}
        <FilterSheet
          label="Cidade"
          value={filters.cityId ?? null}
          options={listCities().map((city) => ({
            value: city.id,
            label: `${city.name} — ${city.uf}`,
          }))}
          onChange={(cityId) => apply({ cityId: cityId ?? undefined })}
          allOptionLabel={defaultCityLabel}
          emptyLabel={defaultCityLabel}
        />

        <FilterSheet
          label="Função"
          value={filters.role ?? null}
          options={ROLE_FILTER_OPTIONS}
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
            className="border-input bg-background focus-visible:ring-ring h-12 w-full rounded-lg border px-4 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
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
