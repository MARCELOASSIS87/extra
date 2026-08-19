import type { Metadata } from "next";
import { CompanyRegistrationForm } from "@/components/company/company-registration-form";

export const metadata: Metadata = {
  title: "Cadastro da empresa",
  description:
    "Cadastre sua empresa com CNPJ e dados do responsável para publicar vagas de trabalho extra.",
};

export default function CadastroEmpresaPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <h1 className="text-balance text-3xl font-bold tracking-tight">
        Cadastro da empresa
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Assinatura mensal para publicar vagas. Gratuito para quem procura
        trabalho.
      </p>
      <CompanyRegistrationForm />
    </div>
  );
}
