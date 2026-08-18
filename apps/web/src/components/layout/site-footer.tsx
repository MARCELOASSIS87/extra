import Link from "next/link";

const legalLinks = [
  { href: "/termos", label: "Termos de uso" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/denuncias", label: "Denunciar" },
];

/**
 * O rodapé carrega a posição da plataforma em texto — é parte da defesa
 * jurídica, não enfeite. Identificar é fato; aprovar seria promessa.
 */
export function SiteFooter() {
  return (
    <footer className="bg-muted/40 mt-12 border-t">
      <div className="text-muted-foreground mx-auto w-full max-w-3xl space-y-4 px-4 py-8 text-sm">
        <p>
          A Extra aproxima empresas e trabalhadores da região. Valor, horário e
          pagamento são combinados diretamente entre as duas partes.
        </p>
        <p>
          Identificamos quem se cadastra e mostramos o histórico informado pelas
          empresas. Não selecionamos nem indicamos ninguém, e não participamos
          da contratação nem do pagamento.
        </p>
        <p className="text-foreground font-medium">
          O trabalhador nunca paga para usar a Extra.
        </p>

        <nav aria-label="Links institucionais">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center rounded-md underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="text-xs">© {new Date().getFullYear()} Extra</p>
      </div>
    </footer>
  );
}
