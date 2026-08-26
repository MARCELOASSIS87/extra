"use client";

import { useEffect, useState } from "react";
import type { ApiResult } from "@extra/shared/types/api";
import type { PublicJobPost } from "@extra/shared/types/job";
import { listMyCompanyJobs } from "@/lib/api/companies";
import { MyJobsView } from "@/components/company/my-jobs-view";

/** Mesma função de lib/api/ do caminho do servidor, chamada do navegador. */
export function MyJobsClient() {
  const [result, setResult] = useState<ApiResult<PublicJobPost[]> | null>(null);

  useEffect(() => {
    let active = true;
    listMyCompanyJobs().then((data) => {
      if (active) setResult(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return <MyJobsView result={result} />;
}
