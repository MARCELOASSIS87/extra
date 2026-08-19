"use client";

import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";

const SELECT_CLASSNAME =
  "border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2";

/**
 * Barra "entrar como" — só existe em modo mock (NEXT_PUBLIC_API_MODE=mock).
 * Sem login de verdade ainda (§11), então esta é a única forma de testar as
 * áreas do trabalhador e da empresa com mais de um usuário. Escreve o cookie
 * direto no navegador (sem HttpOnly, de propósito) e recarrega os Server
 * Components com router.refresh() — sem isso a escolha não chegaria nas
 * páginas que já buscaram dado no servidor.
 */
export function DemoBar({
  workerCookieName,
  workers,
  currentWorkerId,
  companyCookieName,
  companies,
  currentCompanyId,
}: {
  workerCookieName: string;
  workers: readonly { id: string; fullName: string }[];
  currentWorkerId: string;
  companyCookieName: string;
  companies: readonly { id: string; tradeName: string }[];
  currentCompanyId: string;
}) {
  const router = useRouter();

  const change = (cookieName: string, value: string) => {
    const maxAgeSeconds = 60 * 60 * 24 * 30;
    document.cookie = `${cookieName}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
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
          <span className="text-muted-foreground">Trabalhador:</span>
          <select
            value={currentWorkerId}
            onChange={(event) => change(workerCookieName, event.target.value)}
            className={SELECT_CLASSNAME}
          >
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.fullName}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Empresa:</span>
          <select
            value={currentCompanyId}
            onChange={(event) => change(companyCookieName, event.target.value)}
            className={SELECT_CLASSNAME}
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
