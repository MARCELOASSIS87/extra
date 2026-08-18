import Link from "next/link";
import type { JobRole } from "@extra/shared/types/job";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import { cn } from "@/lib/utils";

const roles = Object.keys(JOB_ROLE_LABELS) as JobRole[];

/**
 * Busca por função em links, não em formulário com JavaScript: cada chip é uma
 * URL própria, então funciona sem JS, é indexável e o botão voltar do Android
 * se comporta como o usuário espera.
 */
export function RoleFilter({ selected }: { selected: JobRole | null }) {
  return (
    <nav aria-label="Buscar por função">
      {/* Rolagem horizontal: 12 funções não cabem em 360px.
          - `flex-nowrap` + `shrink-0` nos itens: nunca quebra linha.
          - `after:w-4`: o padding-right é ignorado no fim do scroll no Chrome,
            então o respiro final vem de um pseudo-elemento, senão o último
            chip encosta na borda.
          - `snap-proximity` + `scroll-smooth`: para alinhado sem prender o dedo. */}
      <ul className="-mx-4 flex snap-x snap-proximity scroll-pl-4 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain scroll-smooth pb-2 pl-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] after:w-4 after:shrink-0 after:content-[''] [&::-webkit-scrollbar]:hidden">
        <RoleChip href="/" active={selected === null} label="Todas" />
        {roles.map((role) => (
          <RoleChip
            key={role}
            href={`/?funcao=${role}`}
            active={selected === role}
            label={JOB_ROLE_LABELS[role]}
          />
        ))}
      </ul>
    </nav>
  );
}

function RoleChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <li className="shrink-0 snap-start">
      <Link
        href={href}
        aria-current={active ? "true" : undefined}
        className={cn(
          "focus-visible:ring-ring inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2",
          active
            ? "bg-primary text-primary-foreground border-transparent"
            : "hover:bg-muted",
        )}
      >
        {label}
      </Link>
    </li>
  );
}
