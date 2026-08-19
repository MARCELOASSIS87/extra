import Link from "next/link";
import { RefreshCw, SearchX, WifiOff } from "lucide-react";
import type { JobRole } from "@extra/shared/types/job";
import { CITY } from "@extra/shared/constants/city";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import { jobRoleSchema } from "@extra/shared/schemas/job";
import { listJobs } from "@/lib/api/jobs";
import { JobCard } from "@/components/jobs/job-card";
import { RoleFilterSheet } from "@/components/filters/role-filter-sheet";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HOME_PAGE_SIZE = 12;

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  // Query string é entrada de fora: só passa adiante o que o enum reconhece.
  const parsedRole = jobRoleSchema.safeParse(params.funcao);
  const role: JobRole | null = parsedRole.success ? parsedRole.data : null;

  const result = await listJobs({
    role: role ?? undefined,
    pageSize: HOME_PAGE_SIZE,
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <section>
        {/* Nomeia a cidade em vez de "sua região": não existe seletor de
            região, e o MVP atende uma cidade só. */}
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Trabalho extra em {CITY}
        </h1>
        <p className="mt-4 text-balance text-xl font-medium">
          O trabalho existe. O que falta é organização.
        </p>
        <p className="text-muted-foreground mt-3 text-sm">
          Vagas por diária em cozinha, salão, limpeza, segurança e eventos. Você
          se candidata e combina direto com a empresa.
        </p>

        {/* Os dois caminhos lado a lado: quem chega precisa saber em dois
            segundos qual dos dois é ele. */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/cadastro/trabalhador"
            className={cn(buttonVariants({ size: "lg" }), "h-12 w-full")}
          >
            Quero trabalhar
          </Link>
          <Link
            href="/cadastro/empresa"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-12 w-full",
            )}
          >
            Quero contratar
          </Link>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Cadastro gratuito para quem procura trabalho.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">Vagas abertas</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          As publicadas mais recentemente.
        </p>

        <div className="mt-4">
          <RoleFilterSheet value={role} />
        </div>

        <div className="mt-6">
          {!result.ok ? (
            <ErrorState />
          ) : result.data.items.length === 0 ? (
            <EmptyState role={role} />
          ) : (
            <>
              <ul className="grid gap-3">
                {result.data.items.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  href={role ? `/vagas?funcao=${role}` : "/vagas"}
                  className={cn(buttonVariants({ variant: "outline" }), "h-11")}
                >
                  Ver todas as vagas
                </Link>
                {result.data.total > result.data.items.length && (
                  <p className="text-muted-foreground text-sm">
                    Mostrando {result.data.items.length} de {result.data.total}{" "}
                    vagas abertas.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center">
      <WifiOff
        aria-hidden="true"
        className="text-muted-foreground/60 mx-auto size-8"
      />
      <p className="mt-3 font-medium">Não foi possível carregar as vagas.</p>
      <p className="text-muted-foreground mt-1 text-sm">
        Pode ter sido a conexão. Tente de novo em alguns segundos.
      </p>
      {/* Link para a própria home: recarrega e refaz a busca sem exigir JS. */}
      <Link
        href="/"
        className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
      >
        <RefreshCw aria-hidden="true" className="size-4" />
        Tentar de novo
      </Link>
    </div>
  );
}

function EmptyState({ role }: { role: JobRole | null }) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center">
      <SearchX
        aria-hidden="true"
        className="text-muted-foreground/50 mx-auto size-12"
      />
      <p className="mt-3 font-medium">
        {role
          ? `Nenhuma vaga de ${JOB_ROLE_LABELS[role]} aberta agora.`
          : "Nenhuma vaga aberta agora."}
      </p>
      <p className="text-muted-foreground mt-1 text-sm">
        Vagas novas aparecem todo dia. Cadastre-se para ser avisado quando
        surgir uma da sua função.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {role && (
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Ver todas as vagas
          </Link>
        )}
        <Link href="/cadastro/trabalhador" className={buttonVariants()}>
          Quero trabalhar
        </Link>
      </div>
    </div>
  );
}
