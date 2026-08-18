import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mainNav } from "@/lib/navigation";

/**
 * Cabeçalho fixo. Em 360px cabe só a marca e o botão de entrar; os destinos
 * ficam na barra inferior. A partir de md os links aparecem aqui.
 */
export function SiteHeader() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4">
        <Link
          href="/"
          className="focus-visible:ring-ring rounded-md text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2"
        >
          Extra
        </Link>

        <nav aria-label="Navegação principal" className="ml-4 hidden md:block">
          <ul className="flex items-center gap-1">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Links de verdade, estilizados como botão: nenhum JS de cliente
            precisa descer só para navegar. */}
        <div className="ml-auto flex items-center gap-2">
          {/* cn() resolve o conflito entre `hidden` e o `inline-flex` da base
              do botão. Aqui é Server Component: tailwind-merge não desce pro
              navegador. */}
          <Link
            href="/empresa/vagas/nova"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "hidden sm:inline-flex",
            )}
          >
            Publicar vaga
          </Link>
          <Link href="/entrar" className={buttonVariants()}>
            Entrar
          </Link>
        </div>
      </div>
    </header>
  );
}
