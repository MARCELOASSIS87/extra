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
      {/* Rolagem horizontal: 11 funções não cabem em 360px. */}
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
    <li className="shrink-0">
      <Link
        href={href}
        aria-current={active ? "true" : undefined}
        className={cn(
          "focus-visible:ring-ring inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none",
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
