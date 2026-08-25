"use client";

import { useEffect, useState } from "react";
import type { ApiResult, Paginated } from "@extra/shared/types/api";
import type { JobPost } from "@extra/shared/types/job";
import type { JobFiltersInput } from "@extra/shared/schemas/job";
import {
  getDefaultJobCityIds,
  listJobs,
  listOpenJobNeighborhoods,
} from "@/lib/api/jobs";
import { DEFAULT_CITY_ID } from "@/lib/api/cities";
import { JobsPageView } from "@/components/jobs/jobs-page-view";
import { JOBS_PAGE_SIZE } from "@/lib/job-search";

/** Mesmas funções de lib/api/ do caminho do servidor, chamadas do navegador. */
export function JobsPageClient({
  filters,
  today,
}: {
  filters: JobFiltersInput;
  today: string;
}) {
  const [result, setResult] = useState<ApiResult<Paginated<JobPost>> | null>(
    null,
  );
  const [neighborhoods, setNeighborhoods] = useState<string[] | null>(null);
  // Enquanto não sabe quais são as cidades assinadas, assume a âncora: é o
  // mesmo padrão de quem não tem cadastro, e evita um segundo esqueleto.
  const [defaultCityIds, setDefaultCityIds] = useState<string[]>([
    DEFAULT_CITY_ID,
  ]);

  const { role, cityId, date, neighborhood, page } = filters;

  useEffect(() => {
    let active = true;
    setResult(null);

    // As cidades assinadas vêm primeiro porque a busca depende delas — é
    // leitura de sessão, sem latência simulada. Daí em diante, em paralelo:
    // a lista de bairros não pode somar latência à busca.
    getDefaultJobCityIds().then((cities) => {
      if (!active) return;
      setDefaultCityIds(cities);

      Promise.all([
        listJobs({
          role,
          cityIds: cityId ? [cityId] : cities,
          date,
          neighborhood,
          page: page ?? 1,
          pageSize: JOBS_PAGE_SIZE,
        }),
        listOpenJobNeighborhoods(),
      ]).then(([jobs, neighborhoodsResult]) => {
        if (!active) return;
        setResult(jobs);
        setNeighborhoods(
          neighborhoodsResult.ok ? neighborhoodsResult.data : null,
        );
      });
    });

    return () => {
      active = false;
    };
  }, [role, cityId, date, neighborhood, page]);

  return (
    <JobsPageView
      result={result}
      neighborhoods={neighborhoods}
      filters={filters}
      today={today}
      defaultCityIds={defaultCityIds}
    />
  );
}
