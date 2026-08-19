"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { JobRole } from "@extra/shared/types/job";
import { FilterSheet } from "./filter-sheet";
import { readSavedRole, saveRole } from "@/lib/filter-preferences";
import { ROLE_FILTER_OPTIONS } from "@/lib/job-role-icons";

/**
 * Filtro de função da home. Guarda a escolha e reaplica na próxima visita —
 * quem procura vaga de garçom procura de garçom toda vez.
 *
 * ROLE_FILTER_OPTIONS é importado aqui dentro, não recebido por prop: cada
 * opção carrega um componente de ícone, e função não é dado serializável —
 * um Server Component não pode passar isso como prop para um Client
 * Component ("Functions cannot be passed directly to Client Components").
 * Como este arquivo já é "use client", a lista é montada só do lado do
 * cliente e nunca atravessa essa fronteira.
 */
export function RoleFilterSheet({ value }: { value: JobRole | null }) {
  const router = useRouter();
  const restored = useRef(false);

  useEffect(() => {
    // A URL sempre manda: só restaura quando ninguém pediu função nenhuma.
    if (value !== null || restored.current) return;
    restored.current = true;

    const saved = readSavedRole(
      ROLE_FILTER_OPTIONS.map((option) => option.value),
    );
    if (saved) router.replace(`/?funcao=${saved}`, { scroll: false });
  }, [value, router]);

  const change = (next: JobRole | null) => {
    saveRole(next);
    router.push(next ? `/?funcao=${next}` : "/", { scroll: false });
  };

  return (
    <FilterSheet
      label="Função"
      value={value}
      options={ROLE_FILTER_OPTIONS}
      onChange={change}
      allOptionLabel="Todas as funções"
      emptyLabel="Todas"
    />
  );
}
