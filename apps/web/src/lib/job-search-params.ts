import {
  jobFiltersSchema,
  type JobFiltersInput,
} from "@extra/shared/schemas/job";
import { JOB_SEARCH_PARAM as PARAM } from "./job-search";

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
    cityId: cleaned(params[PARAM.cityId]),
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
