import { cn } from "@/lib/utils";

/**
 * Marca da Extraqui. `bg-primary`/`text-primary-foreground` em vez de
 * verde-700 fixo: no tema escuro esses tokens já viram green-400 com texto
 * quase-preto (10,26:1) — verde-700 fixo com "E" branco caísse para 3,63:1
 * no fundo escuro, abaixo do mínimo que a própria paleta estabeleceu.
 *
 * `markOnly` isola só o quadrado — é o desenho que os ícones estáticos do
 * favicon e do PWA repetem à mão (Satori não renderiza componente React).
 */
export function Logo({
  markOnly = false,
  className,
}: {
  markOnly?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden={markOnly ? undefined : "true"}
        className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg text-base font-bold"
      >
        E
      </span>
      {!markOnly && (
        <span className="text-lg font-bold tracking-tight">
          <span className="text-foreground">Extra</span>
          <span className="text-primary">qui</span>
        </span>
      )}
    </span>
  );
}
