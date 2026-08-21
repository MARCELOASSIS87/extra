import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { navItems } from "@/lib/navigation";
import type { SessionRole } from "@/lib/api/session";

/**
 * Cabeçalho fixo. Em 360px cabe só a marca; os destinos vivem na barra
 * inferior. A partir de md os links aparecem aqui também.
 */
export function SiteHeader({ role }: { role: SessionRole }) {
  const items = navItems(role);

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4">
        <Link
          href="/"
          className="focus-visible:ring-ring rounded-md focus-visible:outline-none focus-visible:ring-2"
        >
          <Logo />
        </Link>

        <nav aria-label="Navegação principal" className="ml-auto hidden md:block">
          <ul className="flex items-center gap-1">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
