"use client";

import { useEffect, useState } from "react";
import { getMyCompany, listMyCompanyJobs } from "@/lib/api/companies";
import { listNewApplicants } from "@/lib/api/applications";
import { listAttendancePending } from "@/lib/api/attendance";
import {
  CompanyPanelView,
  type CompanyPanelData,
} from "@/components/company/company-panel-view";

/** Mesmas funções de lib/api/ do caminho do servidor, chamadas do navegador. */
export function CompanyPanelClient() {
  const [data, setData] = useState<CompanyPanelData | null>(null);

  useEffect(() => {
    let active = true;

    // Em paralelo: as quatro seções não dependem uma da outra.
    Promise.all([
      getMyCompany(),
      listMyCompanyJobs(),
      listNewApplicants(),
      listAttendancePending(),
    ]).then(([company, jobs, applicants, pending]) => {
      if (active) setData({ company, jobs, applicants, pending });
    });

    return () => {
      active = false;
    };
  }, []);

  return <CompanyPanelView data={data} />;
}
