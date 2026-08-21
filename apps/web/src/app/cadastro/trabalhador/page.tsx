import type { Metadata } from "next";
import { getJobBySlug } from "@/lib/api/jobs";
import { WorkerRegistrationForm } from "@/components/worker/worker-registration-form";

export const metadata: Metadata = {
  title: "Cadastro do trabalhador",
  description:
    "Cadastre-se de graça para se candidatar a vagas de trabalho extra.",
};

export default async function CadastroTrabalhadorPage({
  searchParams,
}: PageProps<"/cadastro/trabalhador">) {
  const { vaga } = await searchParams;
  const slug = typeof vaga === "string" ? vaga : undefined;

  // Se o slug veio errado ou a vaga não existe mais, o cadastro segue normal
  // — só não há candidatura automática nem redirecionamento no fim (§16.5).
  const jobResult = slug ? await getJobBySlug(slug) : null;
  const job = jobResult?.ok ? jobResult.data : null;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <h1 className="text-balance text-3xl font-bold tracking-tight">
        Cadastro do trabalhador
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {job
          ? `Depois de cadastrado, você já fica candidatado à vaga de ${job.title}.`
          : "Gratuito. Você recebe notificação das vagas da sua função e região."}
      </p>
      <WorkerRegistrationForm job={job} />
    </div>
  );
}
