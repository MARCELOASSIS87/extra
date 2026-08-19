"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath, navItems } from "@/lib/navigation";

// Sem cn() aqui de propósito: tailwind-merge custa ~10 KB comprimidos e este
// é o único componente de cliente do layout. Não há classe conflitante para
// resolver, então concatenar string basta.

/**
 * Barra inferior — o padrão que o público já conhece do Android.
 * Fica fora do fluxo, então o <body> reserva a altura dela embaixo.
 * Cada alvo tem 64px de altura: dedo em ônibus, não mouse em desktop.
 *
 * Recebe só o booleano: componente de ícone não atravessa a fronteira
 * servidor→cliente, então a lista é montada aqui dentro.
 */
export function MobileNav({ authenticated }: { authenticated: boolean }) {
  const pathname = usePathname();
  const items = navItems(authenticated);

  return (
    <nav
      aria-label="Navegação principal"
      className="bg-background fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-3">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`focus-visible:ring-ring flex h-16 flex-col items-center justify-center gap-1 px-1 text-center text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:-outline-offset-2 focus-visible:ring-2 ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <Icon
                  aria-hidden="true"
                  className={active ? "size-6 stroke-[2.5]" : "size-6"}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
