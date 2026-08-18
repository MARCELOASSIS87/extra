import type { MetadataRoute } from "next";

// Sem service worker ainda: isto só descreve o app para a tela de início.
// O push (§12) entra depois, junto com o SW próprio.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Extra — trabalho extra na sua região",
    short_name: "Extra",
    description:
      "Vagas de trabalho extra por diária na sua região. Cadastro gratuito para quem procura trabalho.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
