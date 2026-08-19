"use client";

import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";

/**
 * Seletor "entrar como" — só existe em modo mock (NEXT_PUBLIC_API_MODE=mock).
 * Sem login de verdade ainda (§11), então esta é a única forma de testar a
 * área da empresa com mais de uma empresa. Escreve o cookie direto no
 * navegador (sem HttpOnly, de propósito) e recarrega os Server Components
 * com router.refresh() — sem isso a escolha não chegaria nas páginas que já
 * buscaram dado no servidor.
 */
export function CompanySwitcher({
  cookieName,
  companies,
  currentCompanyId,
}: {
  cookieName: string;
  companies: readonly { id: string; tradeName: string }[];
  currentCompanyId: string;
}) {
  const router = useRouter();

  const change = (companyId: string) => {
    const maxAgeSeconds = 60 * 60 * 24 * 30;
    document.cookie = `${cookieName}=${encodeURIComponent(companyId)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
    router.refresh();
  };

  return (
    <div className="bg-muted border-b">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm font-medium">
          <FlaskConical aria-hidden="true" className="size-4 shrink-0" />
          Modo de demonstração
        </span>

        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Entrar como:</span>
          <select
            value={currentCompanyId}
            onChange={(event) => change(event.target.value)}
            className="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.tradeName}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
