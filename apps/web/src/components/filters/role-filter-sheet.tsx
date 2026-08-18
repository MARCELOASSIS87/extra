"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { JobRole } from "@extra/shared/types/job";
import { FilterSheet, type FilterOption } from "./filter-sheet";
import { readSavedRole, saveRole } from "@/lib/filter-preferences";

/**
 * Filtro de função da home. Guarda a escolha e reaplica na próxima visita —
 * quem procura vaga de garçom procura de garçom toda vez.
 */
export function RoleFilterSheet({
  value,
  options,
}: {
  value: JobRole | null;
  options: readonly FilterOption<JobRole>[];
}) {
  const router = useRouter();
  const restored = useRef(false);

  useEffect(() => {
    // A URL sempre manda: só restaura quando ninguém pediu função nenhuma.
    if (value !== null || restored.current) return;
    restored.current = true;

    const saved = readSavedRole(options.map((option) => option.value));
    if (saved) router.replace(`/?funcao=${saved}`, { scroll: false });
  }, [value, options, router]);

  const change = (next: JobRole | null) => {
    saveRole(next);
    router.push(next ? `/?funcao=${next}` : "/", { scroll: false });
  };

  return (
    <FilterSheet
      label="Função"
      value={value}
      options={options}
      onChange={change}
      allOptionLabel="Todas as funções"
      emptyLabel="Todas"
    />
  );
}
