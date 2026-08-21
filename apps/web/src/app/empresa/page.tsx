import type { Metadata } from "next";
import { getMyCompany, listMyCompanyJobs } from "@/lib/api/companies";
import { listNewApplicants } from "@/lib/api/applications";
import { listAttendancePending } from "@/lib/api/attendance";
import { isMockMode } from "@/lib/api/mock";
import { CompanyPanelClient } from "@/components/company/company-panel-client";
import { CompanyPanelView } from "@/components/company/company-panel-view";

export const metadata: Metadata = {
  title: "Painel da empresa",
};

export default async function EmpresaPage() {
  // Em modo mock o estado mutável está no localStorage — ver app/page.tsx.
  if (isMockMode) return <CompanyPanelClient />;

  // Em paralelo: as quatro seções não dependem uma da outra.
  const [company, jobs, applicants, pending] = await Promise.all([
    getMyCompany(),
    listMyCompanyJobs(),
    listNewApplicants(),
    listAttendancePending(),
  ]);

  return <CompanyPanelView data={{ company, jobs, applicants, pending }} />;
}
