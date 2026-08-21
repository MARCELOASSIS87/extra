import type { Metadata } from "next";
import { listMyCompanyJobs } from "@/lib/api/companies";
import { isMockMode } from "@/lib/api/mock";
import { MyJobsClient } from "@/components/company/my-jobs-client";
import { MyJobsView } from "@/components/company/my-jobs-view";

export const metadata: Metadata = {
  title: "Minhas vagas",
};

export default async function MinhasVagasPage() {
  // Em modo mock o estado mutável está no localStorage — ver app/page.tsx.
  if (isMockMode) return <MyJobsClient />;

  return <MyJobsView result={await listMyCompanyJobs()} />;
}
