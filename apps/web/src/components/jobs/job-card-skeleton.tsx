/**
 * Mesma forma do JobCard de verdade — badge, título, três linhas de meta,
 * valor — para a lista não "pular" de layout quando os dados chegam.
 */
export function JobCardSkeleton() {
  return (
    <li aria-hidden="true" className="min-w-0 rounded-xl border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="bg-muted h-6 w-28 animate-pulse rounded-md" />
      </div>
      <div className="bg-muted mt-3 h-6 w-4/5 animate-pulse rounded-md" />
      <div className="mt-3 space-y-2">
        <div className="bg-muted h-4 w-32 animate-pulse rounded-md" />
        <div className="bg-muted h-4 w-24 animate-pulse rounded-md" />
        <div className="bg-muted h-4 w-40 animate-pulse rounded-md" />
      </div>
      <div className="bg-muted mt-4 h-6 w-24 animate-pulse rounded-md" />
    </li>
  );
}
