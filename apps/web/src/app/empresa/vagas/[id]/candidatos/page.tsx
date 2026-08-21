import type { Metadata } from "next";
import { JobCandidatesClient } from "@/components/company/job-candidates-client";

export const metadata: Metadata = {
  title: "Candidatos da vaga",
};

export default async function JobCandidatesPage({
  params,
}: PageProps<"/empresa/vagas/[id]/candidatos">) {
  const { id } = await params;

  return <JobCandidatesClient jobId={id} />;
}
