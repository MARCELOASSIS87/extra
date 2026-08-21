// URL pública do site — monta o link absoluto de compartilhar vaga e o
// metadataBase do Open Graph. `NEXT_PUBLIC_*` é inlinado no build, então vale
// tanto em Server quanto em Client Component.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
