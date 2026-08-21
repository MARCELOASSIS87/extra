"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { confirmApplication } from "@/lib/api/applications";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Confirmação de véspera (§16.3). Some da tela ao confirmar sem refazer a
 * busca inteira: o estado local basta, e a home do trabalhador não tem outro
 * bloco que dependa deste dado.
 */
export function ConfirmApplicationButton({
  applicationId,
}: {
  applicationId: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setState("sending");
    setError(null);
    const result = await confirmApplication(applicationId);
    if (!result.ok) {
      setState("idle");
      setError(result.error.message);
      return;
    }
    setState("done");
  };

  if (state === "done") {
    return (
      <p className="text-primary mt-3 flex items-center gap-2 text-sm font-medium">
        <CircleCheck aria-hidden="true" className="size-4" />
        Presença confirmada.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={state === "sending"}
        onClick={confirm}
        className={cn(buttonVariants({ size: "lg" }), "mt-3 h-12 w-full")}
      >
        {state === "sending" ? "Confirmando..." : "Confirmar que vou"}
      </button>
      {error && (
        <p role="alert" className="text-destructive mt-2 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
