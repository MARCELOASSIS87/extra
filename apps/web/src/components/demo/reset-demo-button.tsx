"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { resetMockState } from "@/lib/api/mock";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ResetDemoButton() {
  const router = useRouter();
  const [done, setDone] = useState(false);

  const reset = () => {
    resetMockState();
    setDone(true);
    router.push("/");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={reset}
      disabled={done}
      className={cn(buttonVariants({ size: "lg" }), "mt-6 h-12 w-full")}
    >
      <RotateCcw aria-hidden="true" className="size-4" />
      {done ? "Reiniciado" : "Resetar dados de demonstração"}
    </button>
  );
}
