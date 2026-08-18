// Aparece a cada busca ou troca de página, enquanto a chamada (300–800ms)
// não volta. Os blocos têm a altura do conteúdo real para nada "pular".
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="bg-muted h-8 w-56 animate-pulse rounded-md" />
      <div className="bg-muted mt-2 h-5 w-3/4 animate-pulse rounded-md" />

      <div className="bg-muted/40 mt-6 rounded-lg border p-4">
        <div className="bg-muted h-5 w-32 animate-pulse rounded-md" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="bg-muted h-11 animate-pulse rounded-md" />
          <div className="bg-muted h-11 animate-pulse rounded-md" />
          <div className="bg-muted h-11 animate-pulse rounded-md sm:col-span-2" />
        </div>
        <div className="bg-muted mt-4 h-11 w-full animate-pulse rounded-lg sm:w-36" />
      </div>

      <div className="bg-muted mt-6 h-5 w-40 animate-pulse rounded-md" />
      <ul className="mt-3 grid gap-3" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="bg-muted h-44 animate-pulse rounded-lg" />
        ))}
      </ul>

      <span className="sr-only" role="status">
        Carregando vagas
      </span>
    </div>
  );
}
