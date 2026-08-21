import type { JobRole } from "@extra/shared/types/job";
import { jobRoleSchema } from "@extra/shared/schemas/job";
import { listJobs } from "@/lib/api/jobs";
import { HomeClient } from "@/components/home/home-client";
import { HomeView } from "@/components/home/home-view";
import { isMockMode } from "@/lib/api/mock";
import { HOME_PAGE_SIZE } from "@/lib/job-search";

/**
 * Em modo mock o estado mutável mora no localStorage do navegador, então a
 * busca precisa acontecer lá — o servidor só enxergaria as fixtures e
 * mostraria uma vaga recém-publicada como inexistente. Em modo live isto
 * volta a ser um Server Component comum. A escolha é só de onde renderizar:
 * `listJobs()` é a mesma função nos dois caminhos.
 */
export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  // Query string é entrada de fora: só passa adiante o que o enum reconhece.
  const parsedRole = jobRoleSchema.safeParse(params.funcao);
  const role: JobRole | null = parsedRole.success ? parsedRole.data : null;

  if (isMockMode) return <HomeClient role={role} />;

  const result = await listJobs({
    role: role ?? undefined,
    pageSize: HOME_PAGE_SIZE,
  });

  return <HomeView result={result} role={role} />;
}
