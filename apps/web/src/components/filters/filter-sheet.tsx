"use client";

import { useState } from "react";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type FilterOption<T extends string = string> = {
  value: T;
  label: string;
  /** Opcional: bairro não tem ícone, função tem. */
  icon?: LucideIcon;
};

/**
 * Filtro explícito, em vez de faixa arrastável: o gesto de arrastar não é
 * descoberto por parte do público, e a lista de opções só cresce.
 *
 * O botão diz o que está filtrando agora e abre uma folha por baixo com a
 * lista inteira em coluna — alvos grandes, um por linha, sem gesto nenhum.
 */
export function FilterSheet<T extends string>({
  label,
  value,
  options,
  onChange,
  allOptionLabel,
  emptyLabel,
}: {
  label: string;
  /** `null` = sem filtro. */
  value: T | null;
  options: readonly FilterOption<T>[];
  onChange: (value: T | null) => void;
  /** Primeiro item da lista, ex.: "Todas as funções". */
  allOptionLabel: string;
  /** O que o botão mostra quando não há filtro, ex.: "Todas". */
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const SelectedIcon = selected?.icon;

  const choose = (next: T | null) => {
    setOpen(false);
    onChange(next);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            // h-12 = 48px: alvo confortável e claramente tocável.
            className="border-input bg-background hover:bg-muted focus-visible:ring-ring flex h-12 w-full items-center justify-between gap-3 rounded-lg border px-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          {SelectedIcon && (
            <SelectedIcon aria-hidden="true" className="size-4 shrink-0" />
          )}
          <span className="truncate">
            <span className="text-muted-foreground">{label}: </span>
            <span className="font-medium">{selected?.label ?? emptyLabel}</span>
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="text-foreground size-5 shrink-0"
        />
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="flex max-h-[80svh] flex-col gap-0 rounded-t-xl p-0"
      >
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle>{label}</SheetTitle>
        </SheetHeader>

        {/* Rola na vertical. `min-h-0` é o que permite encolher dentro do
            flex-col do sheet — sem isso a lista cresce e não rola.
            O padding de baixo mantém o último item acima da barra de
            navegação e da área de gestos do aparelho. */}
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(4rem+env(safe-area-inset-bottom))]">
          <FilterOptionItem
            label={allOptionLabel}
            selected={value === null}
            onSelect={() => choose(null)}
          />
          {options.map((option) => (
            <FilterOptionItem
              key={option.value}
              label={option.label}
              icon={option.icon}
              selected={option.value === value}
              onSelect={() => choose(option.value)}
            />
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

function FilterOptionItem({
  label,
  icon: Icon,
  selected,
  onSelect,
}: {
  label: string;
  icon?: LucideIcon;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        // min-h-13 = 52px
        className={cn(
          "focus-visible:ring-ring min-h-13 flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:-outline-offset-2 focus-visible:ring-2",
          selected
            ? "bg-accent text-accent-foreground font-medium"
            : "hover:bg-muted",
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          {Icon && <Icon aria-hidden="true" className="size-5 shrink-0" />}
          <span className="truncate">{label}</span>
        </span>
        {selected && <Check aria-hidden="true" className="size-5 shrink-0" />}
      </button>
    </li>
  );
}
