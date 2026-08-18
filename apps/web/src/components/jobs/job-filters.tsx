import Link from "next/link";
import type { JobRole } from "@extra/shared/types/job";
import type { JobFiltersInput } from "@extra/shared/schemas/job";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hasActiveFilters, JOB_SEARCH_PARAM } from "@/lib/job-search";

const roles = Object.keys(JOB_ROLE_LABELS) as JobRole[];

const fieldClass =
  "border-input bg-background focus-visible:ring-ring h-11 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none";

const labelClass = "text-sm font-medium";

/**
 * Formulário GET puro: cada busca vira uma URL própria, funciona sem
 * JavaScript e o botão voltar do Android faz o que o usuário espera.
 * Nada aqui desce como código para o navegador.
 */
export function JobFilters({
  filters,
  neighborhoods,
  today,
}: {
  filters: JobFiltersInput;
  /** `null` quando a busca de bairros falhou — o resto do filtro continua de pé. */
  neighborhoods: string[] | null;
  today: string;
}) {
  return (
    <form
      action="/vagas"
      method="get"
      className="bg-muted/40 rounded-lg border p-4"
    >
      <h2 className="text-base font-semibold">Filtrar vagas</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor="filtro-funcao" className={labelClass}>
            Função
          </label>
          <select
            id="filtro-funcao"
            name={JOB_SEARCH_PARAM.role}
            defaultValue={filters.role ?? ""}
            className={fieldClass}
          >
            <option value="">Todas as funções</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {JOB_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="filtro-data" className={labelClass}>
            Data
          </label>
          {/* Campo de data nativo: o Android já traz o calendário dele, em
              português, sem nenhuma biblioteca. */}
          <input
            id="filtro-data"
            type="date"
            name={JOB_SEARCH_PARAM.date}
            defaultValue={filters.date ?? ""}
            min={today}
            className={fieldClass}
          />
        </div>

        {neighborhoods === null ? (
          // Sem a lista, preserva o bairro já escolhido em vez de perdê-lo.
          <input
            type="hidden"
            name={JOB_SEARCH_PARAM.neighborhood}
            value={filters.neighborhood ?? ""}
          />
        ) : (
          <div className="grid gap-1.5 sm:col-span-2">
            <label htmlFor="filtro-bairro" className={labelClass}>
              Bairro
            </label>
            <select
              id="filtro-bairro"
              name={JOB_SEARCH_PARAM.neighborhood}
              defaultValue={filters.neighborhood ?? ""}
              className={fieldClass}
            >
              <option value="">Todos os bairros</option>
              {neighborhoods.map((neighborhood) => (
                <option key={neighborhood} value={neighborhood}>
                  {neighborhood}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className={cn(buttonVariants(), "h-11 flex-1 sm:flex-none")}
        >
          Buscar vagas
        </button>
        {hasActiveFilters(filters) && (
          <Link
            href="/vagas"
            className={cn(buttonVariants({ variant: "ghost" }), "h-11")}
          >
            Limpar filtros
          </Link>
        )}
      </div>
    </form>
  );
}
