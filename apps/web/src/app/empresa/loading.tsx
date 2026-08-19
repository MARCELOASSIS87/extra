// Aparece enquanto o nome da empresa e as vagas carregam (300–800ms do mock).
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="bg-muted h-9 w-56 animate-pulse rounded-md" />
      <div className="bg-muted mt-2 h-5 w-64 animate-pulse rounded-md" />

      <ul className="mt-6 grid gap-3" aria-hidden="true">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="min-w-0 rounded-xl border p-4 shadow-sm">
            <div className="bg-muted h-6 w-24 animate-pulse rounded-md" />
            <div className="bg-muted mt-3 h-6 w-4/5 animate-pulse rounded-md" />
            <div className="bg-muted mt-2 h-4 w-32 animate-pulse rounded-md" />
          </li>
        ))}
      </ul>

      <span className="sr-only" role="status">
        Carregando painel da empresa
      </span>
    </div>
  );
}
