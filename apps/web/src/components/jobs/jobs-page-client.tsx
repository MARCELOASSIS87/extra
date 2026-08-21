"use client";

import { useEffect, useState } from "react";
import type { ApiResult, Paginated } from "@extra/shared/types/api";
import type { JobPost } from "@extra/shared/types/job";
import type { JobFiltersInput } from "@extra/shared/schemas/job";
import { listJobs, listOpenJobNeighborhoods } from "@/lib/api/jobs";
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

  const { role, date, neighborhood, page } = filters;

  useEffect(() => {
    let active = true;
    setResult(null);

    // Em paralelo: a lista de bairros não pode somar latência à busca.
    Promise.all([
      listJobs({
        role,
        date,
        neighborhood,
        page: page ?? 1,
        pageSize: JOBS_PAGE_SIZE,
      }),
      listOpenJobNeighborhoods(),
    ]).then(([jobs, neighborhoodsResult]) => {
      if (!active) return;
      setResult(jobs);
      setNeighborhoods(neighborhoodsResult.ok ? neighborhoodsResult.data : null);
    });

    return () => {
      active = false;
    };
  }, [role, date, neighborhood, page]);

  return (
    <JobsPageView
      result={result}
      neighborhoods={neighborhoods}
      filters={filters}
      today={today}
    />
  );
}
