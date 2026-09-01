import type { Metadata, Viewport } from "next";
import { CITY } from "@extra/shared/constants/city";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { DemoBar } from "@/components/layout/demo-bar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { isMockMode } from "@/lib/api/mock";
import { getSessionRole } from "@/lib/api/session";
import { SITE_URL } from "@/lib/site";

// Uma família só: cada peso ausente força o navegador a sintetizar negrito,
// o que borra a letra. 400 corpo, 500 ênfase, 700 título, 800 herói (§
// identidade visual — "peso 800" no título da home).
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  // Sem isso, og:image de rota (opengraph-image.tsx) sai com URL relativa —
  // funciona no preview do Next, mas quebra em quem raspa o link de fora.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `Extraqui — trabalho extra em ${CITY}`,
    template: "%s · Extraqui",
  },
  description:
    "Vagas de trabalho extra por diária: garçom, cozinha, limpeza, segurança e mais. Cadastro gratuito para quem procura trabalho.",
  applicationName: "Extraqui",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Extraqui", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Deixa o conteúdo respeitar as bordas arredondadas e a barra de gestos
  // quando roda instalado (standalone).
  viewportFit: "cover",
  // Cor da barra do navegador = fundo real de cada tema (globals.css), não um
  // preto genérico — senão a barra do sistema destoa do app por baixo dela.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c0b" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // TODO: ler o cookie aqui torna toda rota dinâmica. Quando o detalhe da
  // vaga precisar de SSG/ISR para indexar no Google (§15), esta leitura desce
  // para um componente sob <Suspense> com PPR.
  const role = await getSessionRole();

  return (
    <html
      lang="pt-BR"
      className={`${plusJakartaSans.variable} h-full antialiased`}
    >
      {/* A barra inferior é fixa: o padding embaixo evita que ela cubra o rodapé. */}
      <body className="flex min-h-full flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <a
          href="#conteudo"
          className="bg-background focus:ring-ring sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:ring-2"
        >
          Pular para o conteúdo
        </a>

        {isMockMode && <DemoBar currentRole={role} />}

        <SiteHeader role={role} />

        {/* min-w-0: <main> é o único item flex entre o conteúdo da página e a
            raiz. Sem isso, um filho com overflow-x pode esticar o item pela
            largura do conteúdo e empurrar a página inteira. */}
        <main id="conteudo" className="min-w-0 flex-1">
          {children}
        </main>

        <SiteFooter />
        <MobileNav role={role} />
      </body>
    </html>
  );
}
