// Aparece enquanto a busca por função carrega. Os blocos têm a altura dos
// cartões reais para a lista não "pular" quando os dados chegam.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="bg-muted h-8 w-3/4 animate-pulse rounded-md" />
      <div className="bg-muted mt-3 h-12 w-full animate-pulse rounded-md" />

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="bg-muted h-12 animate-pulse rounded-lg" />
        <div className="bg-muted h-12 animate-pulse rounded-lg" />
      </div>

      <div className="mt-10 space-y-4">
        <div className="bg-muted h-6 w-40 animate-pulse rounded-md" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="bg-muted h-11 w-28 shrink-0 animate-pulse rounded-full"
            />
          ))}
        </div>
        <ul className="grid gap-3" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="bg-muted h-44 animate-pulse rounded-lg" />
          ))}
        </ul>
      </div>

      <span className="sr-only" role="status">
        Carregando vagas
      </span>
    </div>
  );
}
