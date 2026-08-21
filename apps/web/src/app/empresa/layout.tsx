import { redirect } from "next/navigation";
import { getSessionRole } from "@/lib/api/session";
import { isMockMode } from "@/lib/api/mock";

/**
 * Fora do modo mock, a área da empresa vai exigir sessão de verdade quando o
 * §11 existir. Em mock não há como logar de verdade ainda, então a checagem
 * é pulada — a barra de demonstração do layout raiz cobre o "quem está
 * entrando" e some sozinha quando NEXT_PUBLIC_API_MODE deixar de ser mock.
 */
export default async function EmpresaLayout({
  children,
}: LayoutProps<"/empresa">) {
  if (!isMockMode && (await getSessionRole()) === "anonymous") {
    redirect("/entrar");
  }

  return children;
}
