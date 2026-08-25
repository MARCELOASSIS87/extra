import type { Metadata } from "next";
import { CITY } from "@extra/shared/constants/city";
import {
  getDefaultJobCityIds,
  listJobs,
  listOpenJobNeighborhoods,
} from "@/lib/api/jobs";
import { JobsPageClient } from "@/components/jobs/jobs-page-client";
import { JobsPageView } from "@/components/jobs/jobs-page-view";
import { isMockMode } from "@/lib/api/mock";
import { JOBS_PAGE_SIZE } from "@/lib/job-search";
import { parseJobSearchParams } from "@/lib/job-search-params";

export const metadata: Metadata = {
  title: "Vagas abertas",
  description: `Todas as vagas de trabalho extra abertas em ${CITY}. Filtre por função, data e bairro.`,
};

export default async function JobsPage({ searchParams }: PageProps<"/vagas">) {
  const filters = parseJobSearchParams(await searchParams);
  const page = filters.page ?? 1;

  // Calculado aqui (sempre no servidor) e passado adiante: se a view
  // calculasse, o valor poderia virar na hidratação de uma sessão aberta
  // pela meia-noite e a data mínima do filtro divergiria.
  const today = new Date().toISOString().slice(0, 10);

  // Em modo mock o estado mutável está no localStorage — ver app/page.tsx.
  if (isMockMode) return <JobsPageClient filters={filters} today={today} />;

  // Sem `?cidade=` na URL a busca acontece nas cidades assinadas (§16.2):
  // nunca abrir mostrando o país inteiro.
  const defaultCityIds = await getDefaultJobCityIds();

  // Em paralelo: a lista de bairros não pode somar latência à busca.
  const [result, neighborhoodsResult] = await Promise.all([
    listJobs({
      role: filters.role,
      cityIds: filters.cityId ? [filters.cityId] : defaultCityIds,
      date: filters.date,
      neighborhood: filters.neighborhood,
      page,
      pageSize: JOBS_PAGE_SIZE,
    }),
    listOpenJobNeighborhoods(),
  ]);

  return (
    <JobsPageView
      result={result}
      neighborhoods={neighborhoodsResult.ok ? neighborhoodsResult.data : null}
      filters={filters}
      today={today}
      defaultCityIds={defaultCityIds}
    />
  );
}
