import type { Metadata } from "next";
import { ResetDemoButton } from "@/components/demo/reset-demo-button";

export const metadata: Metadata = {
  title: "Resetar demonstração",
  robots: { index: false, follow: false },
};

export default function DemoResetPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
      <h1 className="text-balance text-2xl font-bold tracking-tight">
        Resetar demonstração
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Apaga as vagas publicadas neste navegador e recoloca o conjunto
        inicial de exemplo. Não afeta nenhum outro navegador ou dispositivo.
      </p>
      <ResetDemoButton />
    </div>
  );
}
