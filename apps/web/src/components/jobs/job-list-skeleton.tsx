/**
 * Espaço reservado enquanto a listagem carrega. Em modo mock o dado vem do
 * localStorage, que só existe depois da hidratação — sem isto a tela pularia
 * do vazio para a lista pronta.
 */
export function JobListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul className="grid gap-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          className="bg-muted h-44 animate-pulse rounded-xl border"
        />
      ))}
    </ul>
  );
}
