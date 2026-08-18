import {
  jobFiltersSchema,
  type JobFiltersInput,
} from "@extra/shared/schemas/job";

export const JOBS_PAGE_SIZE = 10;

/**
 * A query string é pública e indexável, então os nomes ficam em português.
 * A tradução para os campos do contrato mora só aqui.
 */
const PARAM = {
  role: "funcao",
  date: "data",
  neighborhood: "bairro",
  page: "pagina",
} as const;

type RawSearchParams = Record<string, string | string[] | undefined>;

// `?funcao=a&funcao=b` é válido em HTTP; a listagem usa só o primeiro valor.
const firstValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

// Campo vazio de formulário GET chega como "" — isso é "sem filtro".
const cleaned = (value: string | string[] | undefined) => {
  const first = firstValue(value)?.trim();
  return first ? first : undefined;
};

export function parseJobSearchParams(params: RawSearchParams): JobFiltersInput {
  const parsed = jobFiltersSchema.safeParse({
    role: cleaned(params[PARAM.role]),
    date: cleaned(params[PARAM.date]),
    neighborhood: cleaned(params[PARAM.neighborhood]),
    page: cleaned(params[PARAM.page]),
  });

  if (!parsed.success) return {};

  // O zod devolve a chave com `undefined` quando o filtro não veio; tirar
  // essas chaves deixa o objeto previsível para quem serializa ou compara.
  return Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined),
  );
}

/** Monta a URL da listagem preservando os filtros atuais. */
export function jobsHref(
  filters: JobFiltersInput,
  overrides: Partial<JobFiltersInput> = {},
): string {
  const merged = { ...filters, ...overrides };
  const query = new URLSearchParams();

  if (merged.role) query.set(PARAM.role, merged.role);
  if (merged.date) query.set(PARAM.date, merged.date);
  if (merged.neighborhood) query.set(PARAM.neighborhood, merged.neighborhood);
  // Página 1 é o padrão: não suja a URL nem cria duas URLs para o mesmo conteúdo.
  if (merged.page && merged.page > 1)
    query.set(PARAM.page, String(merged.page));

  const queryString = query.toString();
  return queryString ? `/vagas?${queryString}` : "/vagas";
}

export function hasActiveFilters(filters: JobFiltersInput): boolean {
  return Boolean(filters.role || filters.date || filters.neighborhood);
}

export const JOB_SEARCH_PARAM = PARAM;
