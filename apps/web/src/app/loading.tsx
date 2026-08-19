import { JobCardSkeleton } from "@/components/jobs/job-card-skeleton";

// Aparece enquanto a busca por função carrega. Os blocos têm a forma e a
// altura do conteúdo real para a tela não "pular" quando os dados chegam.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="bg-muted h-9 w-3/4 animate-pulse rounded-md" />
      <div className="bg-muted mt-4 h-7 w-2/3 animate-pulse rounded-md" />
      <div className="bg-muted mt-3 h-5 w-full animate-pulse rounded-md" />

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="bg-muted h-12 animate-pulse rounded-lg" />
        <div className="bg-muted h-12 animate-pulse rounded-lg" />
      </div>

      <div className="mt-10 space-y-4">
        <div className="bg-muted h-7 w-40 animate-pulse rounded-md" />
        {/* Mesma altura do botão do filtro de função (FilterSheet). */}
        <div className="bg-muted h-12 w-full animate-pulse rounded-lg" />
        <ul className="grid gap-3" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <JobCardSkeleton key={i} />
          ))}
        </ul>
      </div>

      <span className="sr-only" role="status">
        Carregando vagas
      </span>
    </div>
  );
}
