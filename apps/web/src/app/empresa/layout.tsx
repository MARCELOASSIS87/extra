import { redirect } from "next/navigation";
import { CompanySwitcher } from "@/components/company/company-switcher";
import { isAuthenticated } from "@/lib/api/session";
import {
  DEMO_COMPANY_COOKIE,
  getCurrentCompanyId,
  getDemoCompanyOptions,
  isMockMode,
} from "@/lib/api/mock";

/**
 * Fora do modo mock, a área da empresa vai exigir sessão de verdade quando o
 * §11 existir. Em mock não há como logar de verdade ainda, então a checagem
 * é pulada e o seletor abaixo cobre o "quem está entrando" — é só para
 * demonstração e some sozinho quando NEXT_PUBLIC_API_MODE deixar de ser mock.
 */
export default async function EmpresaLayout({
  children,
}: LayoutProps<"/empresa">) {
  if (!isMockMode && !(await isAuthenticated())) {
    redirect("/entrar");
  }

  return (
    <>
      {isMockMode && (
        <CompanySwitcher
          cookieName={DEMO_COMPANY_COOKIE}
          companies={getDemoCompanyOptions()}
          currentCompanyId={await getCurrentCompanyId()}
        />
      )}
      {children}
    </>
  );
}
