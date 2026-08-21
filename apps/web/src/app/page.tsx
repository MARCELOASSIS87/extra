import { redirect } from "next/navigation";
import type { JobRole } from "@extra/shared/types/job";
import { jobRoleSchema } from "@extra/shared/schemas/job";
import { listMyApplicationsWithJob } from "@/lib/api/applications";
import { listJobs, listJobsForMe } from "@/lib/api/jobs";
import { getMyWorkerProfile } from "@/lib/api/workers";
import { HomeClient } from "@/components/home/home-client";
import { HomeView } from "@/components/home/home-view";
import { WorkerHomeClient } from "@/components/home/worker-home-client";
import { WorkerHomeView } from "@/components/home/worker-home-view";
import { isMockMode } from "@/lib/api/mock";
import { getSessionRole } from "@/lib/api/session";
import { HOME_PAGE_SIZE } from "@/lib/job-search";

/**
 * A home muda com o papel, não só o menu: quem já entrou não vê tela de
 * conversão. Empresa nem chega aqui — vaga pública não é a tela dela.
 *
 * Em modo mock o estado mutável mora no localStorage do navegador, então a
 * busca precisa acontecer lá — o servidor só enxergaria as fixtures e
 * mostraria uma vaga recém-publicada como inexistente. Em modo live isto
 * volta a ser um Server Component comum. A escolha é só de onde renderizar:
 * as funções de lib/api/ são as mesmas nos dois caminhos.
 */
export default async function Home({ searchParams }: PageProps<"/">) {
  const role = await getSessionRole();

  if (role === "company") redirect("/empresa");

  if (role === "worker") {
    if (isMockMode) return <WorkerHomeClient />;

    // Em paralelo: as três seções não dependem uma da outra.
    const [worker, applications, jobs] = await Promise.all([
      getMyWorkerProfile(),
      listMyApplicationsWithJob(),
      listJobsForMe(),
    ]);

    return (
      <WorkerHomeView
        data={{ worker, applications, jobs }}
        today={new Date().toISOString().slice(0, 10)}
      />
    );
  }

  const params = await searchParams;
  // Query string é entrada de fora: só passa adiante o que o enum reconhece.
  const parsedRole = jobRoleSchema.safeParse(params.funcao);
  const jobRole: JobRole | null = parsedRole.success ? parsedRole.data : null;

  if (isMockMode) return <HomeClient role={jobRole} />;

  const result = await listJobs({
    role: jobRole ?? undefined,
    pageSize: HOME_PAGE_SIZE,
  });

  return <HomeView result={result} role={jobRole} />;
}
