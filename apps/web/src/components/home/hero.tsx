import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Herói da home — Superfície 1 da identidade visual (sempre escura,
 * independente do tema do sistema): cores literais, não os tokens
 * `--primary`/`--border` etc. de `globals.css`, que hoje ainda são a
 * Superfície 2 (clara, usada em vagas/cadastro/painel). Cores em hex fixo de
 * propósito — nada aqui deve reagir a light/dark do visitante.
 */
export function HomeHero({ cityLabel }: { cityLabel: string }) {
  return (
    <section className="bg-[#0A0C0B] text-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:py-24">
        <span className="inline-flex items-center rounded-full bg-[#A3E635] px-3 py-1 text-xs font-medium text-[#0A0C0B]">
          {cityLabel}
        </span>

        {/* Truque das duas cores: primeira linha em foreground (branco),
            segunda em lime-400 — quebra forçada com <span block>, não deixado
            para o navegador decidir onde a frase embrulha. */}
        <h1 className="mt-6 text-balance text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[64px]">
          <span className="block">O trabalho existe.</span>
          <span className="block text-[#A3E635]">
            O que falta é organização.
          </span>
        </h1>

        <p className="mt-6 max-w-prose text-base text-[#A1A1AA]">
          Vagas por diária em cozinha, salão, limpeza, segurança e eventos.
          Você se candidata e combina direto com a empresa.
        </p>

        {/* Os dois caminhos lado a lado: quem chega precisa saber em dois
            segundos qual dos dois é ele. */}
        <div className="mt-8 grid gap-3 sm:max-w-md sm:grid-cols-2">
          <Link
            href="/cadastro/trabalhador"
            className={cn(
              "inline-flex h-12 w-full items-center justify-center rounded-lg px-4 text-base font-semibold transition-colors duration-150",
              "bg-[#A3E635] text-[#0A0C0B] hover:bg-[#BEF264]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3E635] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0C0B]",
            )}
          >
            Quero trabalhar
          </Link>
          <Link
            href="/cadastro/empresa"
            className={cn(
              "inline-flex h-12 w-full items-center justify-center rounded-lg border border-white bg-transparent px-4 text-base font-semibold text-white transition-colors duration-150 hover:bg-white/10",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0C0B]",
            )}
          >
            Quero contratar
          </Link>
        </div>
        <p className="mt-3 text-xs text-[#A1A1AA]">
          Cadastro gratuito para quem procura trabalho.
        </p>
      </div>
    </section>
  );
}
