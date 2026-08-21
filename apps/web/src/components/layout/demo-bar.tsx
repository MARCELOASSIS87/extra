"use client";

import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import {
  DEMO_COMPANY_COOKIE,
  DEMO_ROLE_COOKIE,
  DEMO_WORKER_COOKIE,
  getCurrentCompanyId,
  getCurrentWorkerId,
  getDemoCompanyOptions,
  getDemoWorkerOptions,
} from "@/lib/api/mock";
import type { SessionRole } from "@/lib/api/session";

const SELECT_CLASSNAME =
  "border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2";

const ROLE_LABELS: Record<SessionRole, string> = {
  anonymous: "Visitante",
  worker: "Trabalhador",
  company: "Empresa",
};

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function writeCookie(name: string, value: string): void {
  const maxAge = value ? COOKIE_MAX_AGE_SECONDS : 0;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

/**
 * Barra "entrar como" — só existe em modo mock (NEXT_PUBLIC_API_MODE=mock).
 * Sem login de verdade ainda (§11), então esta é a única forma de testar as
 * áreas do trabalhador e da empresa com mais de um usuário.
 *
 * Dois passos, nesta ordem: primeiro o papel, depois a pessoa daquele papel —
 * em Visitante não existe pessoa para escolher. Escreve os mesmos cookies que
 * `getSessionRole()` e `getCurrentWorkerId()/getCurrentCompanyId()` já leem,
 * então a persona escolhida é a mesma que o menu, os guardas de rota e a
 * camada de dados enxergam.
 *
 * A lista de pessoas é montada no cliente, depois da montagem: o estado
 * mutável mora no localStorage, e no servidor só existiriam as fixtures — uma
 * empresa ou um trabalhador criado durante a demonstração não apareceria.
 */
export function DemoBar({ currentRole }: { currentRole: SessionRole }) {
  const [people, setPeople] = useState<{ id: string; label: string }[] | null>(
    null,
  );
  const [currentPersonId, setCurrentPersonId] = useState("");

  useEffect(() => {
    if (currentRole === "anonymous") {
      setPeople(null);
      return;
    }

    let active = true;

    const load = async () => {
      const isWorker = currentRole === "worker";
      const options = isWorker
        ? getDemoWorkerOptions().map((w) => ({ id: w.id, label: w.fullName }))
        : getDemoCompanyOptions().map((c) => ({ id: c.id, label: c.tradeName }));
      const id = isWorker
        ? await getCurrentWorkerId()
        : await getCurrentCompanyId();

      if (!active) return;
      setPeople(options);
      setCurrentPersonId(id);
    };

    void load();

    return () => {
      active = false;
    };
  }, [currentRole]);

  // Trocar de papel zera a pessoa e recarrega tudo pela raiz: a home agora é
  // diferente para cada papel, e ficar numa tela do papel anterior (o painel
  // da empresa como trabalhador, por exemplo) não faria sentido.
  const changeRole = (role: string) => {
    writeCookie(DEMO_ROLE_COOKIE, role);
    writeCookie(DEMO_WORKER_COOKIE, "");
    writeCookie(DEMO_COMPANY_COOKIE, "");
    window.location.assign("/");
  };

  // Trocar de pessoa mantém a tela: mesmo papel, outro dono do dado.
  const changePerson = (id: string) => {
    writeCookie(
      currentRole === "worker" ? DEMO_WORKER_COOKIE : DEMO_COMPANY_COOKIE,
      id,
    );
    window.location.reload();
  };

  return (
    <div className="bg-muted border-b">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm font-medium">
          <FlaskConical aria-hidden="true" className="size-4 shrink-0" />
          Modo de demonstração
        </span>

        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Ver como:</span>
          <select
            value={currentRole}
            onChange={(event) => changeRole(event.target.value)}
            className={SELECT_CLASSNAME}
          >
            {(Object.keys(ROLE_LABELS) as SessionRole[]).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>

        {people && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {currentRole === "worker" ? "Trabalhador:" : "Empresa:"}
            </span>
            <select
              value={currentPersonId}
              onChange={(event) => changePerson(event.target.value)}
              className={SELECT_CLASSNAME}
            >
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
