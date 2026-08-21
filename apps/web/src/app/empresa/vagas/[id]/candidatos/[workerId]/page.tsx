import type { Metadata } from "next";
import { CandidateProfileClient } from "@/components/company/candidate-profile-client";

export const metadata: Metadata = {
  title: "Perfil do candidato",
};

export default async function JobCandidateProfilePage({
  params,
}: PageProps<"/empresa/vagas/[id]/candidatos/[workerId]">) {
  const { id, workerId } = await params;

  return <CandidateProfileClient jobId={id} workerId={workerId} />;
}
