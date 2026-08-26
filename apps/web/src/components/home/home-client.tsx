"use client";

import { useEffect, useState } from "react";
import type { ApiResult, Paginated } from "@extra/shared/types/api";
import type { PublicJobPost, JobRole } from "@extra/shared/types/job";
import { listJobs } from "@/lib/api/jobs";
import { HomeView } from "@/components/home/home-view";
import { HOME_PAGE_SIZE } from "@/lib/job-search";

/**
 * Mesma `listJobs()` de sempre, só chamada do navegador: em modo mock o
 * estado mutável vive no localStorage, que o servidor não enxerga. A camada
 * de dados é a mesma dos dois lados — muda só quem chama.
 */
export function HomeClient({ role }: { role: JobRole | null }) {
  const [result, setResult] = useState<ApiResult<
    Paginated<PublicJobPost>
  > | null>(null);

  useEffect(() => {
    let active = true;
    setResult(null);

    listJobs({ role: role ?? undefined, pageSize: HOME_PAGE_SIZE }).then(
      (data) => {
        // Filtro trocado no meio da busca: a resposta velha não pode
        // sobrescrever a nova.
        if (active) setResult(data);
      },
    );

    return () => {
      active = false;
    };
  }, [role]);

  return <HomeView result={result} role={role} />;
}
