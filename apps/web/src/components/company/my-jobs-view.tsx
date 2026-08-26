import Link from "next/link";
import { Briefcase, RefreshCw, WifiOff } from "lucide-react";
import type { ApiResult } from "@extra/shared/types/api";
import type { PublicJobPost } from "@extra/shared/types/job";
import { JobCard } from "@/components/jobs/job-card";
import { JobListSkeleton } from "@/components/jobs/job-list-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Tudo o que a empresa publicou, em qualquer estado — mesma
 * `listMyCompanyJobs()` que o painel usa. `null` é "ainda carregando".
 */
export function MyJobsView({
  result,
}: {
  result: ApiResult<PublicJobPost[]> | null;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Minhas vagas
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Tudo o que sua empresa publicou, da mais recente para a mais antiga.
          </p>
        </div>
        <Link href="/empresa/vagas/nova" className={buttonVariants()}>
          Publicar vaga
        </Link>
      </div>

      <div className="mt-6">
        {result === null ? (
          <JobListSkeleton />
        ) : !result.ok ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <WifiOff
              aria-hidden="true"
              className="text-muted-foreground/60 mx-auto size-8"
            />
            <p className="mt-3 font-medium">
              Não foi possível carregar suas vagas.
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Pode ter sido a conexão. Tente de novo em alguns segundos.
            </p>
            <Link
              href="/empresa/vagas"
              className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Tentar de novo
            </Link>
          </div>
        ) : result.data.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <Briefcase
              aria-hidden="true"
              className="text-muted-foreground/50 mx-auto size-10"
            />
            <p className="mt-3 font-medium">Nenhuma vaga publicada ainda.</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Publique uma vaga para ela aparecer aqui.
            </p>
            <Link
              href="/empresa/vagas/nova"
              className={cn(buttonVariants(), "mt-4")}
            >
              Publicar vaga
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3">
            {result.data.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
