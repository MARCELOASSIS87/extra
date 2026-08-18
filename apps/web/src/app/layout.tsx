import type { Metadata, Viewport } from "next";
import { CITY } from "@extra/shared/constants/city";
import { Geist } from "next/font/google";
import "./globals.css";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { isAuthenticated } from "@/lib/api/session";

// Uma família só: cada fonte extra é download em 4G limitado.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `Extra — trabalho extra em ${CITY}`,
    template: "%s · Extra",
  },
  description:
    "Vagas de trabalho extra por diária: garçom, cozinha, limpeza, segurança e mais. Cadastro gratuito para quem procura trabalho.",
  applicationName: "Extra",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Extra", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Deixa o conteúdo respeitar as bordas arredondadas e a barra de gestos
  // quando roda instalado (standalone).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // ponytail: ler o cookie aqui torna toda rota dinâmica. Quando o detalhe da
  // vaga precisar de SSG/ISR para indexar no Google (§15), esta leitura desce
  // para um componente sob <Suspense> com PPR.
  const authenticated = await isAuthenticated();

  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      {/* A barra inferior é fixa: o padding embaixo evita que ela cubra o rodapé. */}
      <body className="flex min-h-full flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <a
          href="#conteudo"
          className="bg-background focus:ring-ring sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:ring-2"
        >
          Pular para o conteúdo
        </a>

        <SiteHeader authenticated={authenticated} />

        {/* min-w-0: <main> é o único item flex entre a faixa de chips e a
            raiz. Sem isso, um filho com overflow-x pode esticar o item pela
            largura do conteúdo e empurrar a página. */}
        <main id="conteudo" className="min-w-0 flex-1">
          {children}
        </main>

        <SiteFooter />
        <MobileNav authenticated={authenticated} />
      </body>
    </html>
  );
}
