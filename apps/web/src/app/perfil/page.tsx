import type { Metadata } from "next";
import { WorkerNotificationsClient } from "@/components/worker/worker-notifications-client";

export const metadata: Metadata = {
  title: "Meu perfil",
  description: "Escolha de quais cidades você quer receber aviso de vaga.",
};

/**
 * Por enquanto o perfil é uma coisa só: de onde receber aviso (§16.2). É o
 * ajuste que decide se a pessoa recebe vaga demais, de menos, ou nenhuma —
 * e o único que ela vai querer mexer depois de se cadastrar.
 *
 * Cliente porque o estado mutável mora no localStorage em modo mock, igual
 * às outras telas de dado editável.
 */
export default function PerfilPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <h1 className="text-balance text-3xl font-bold tracking-tight">
        Meu perfil
      </h1>
      <WorkerNotificationsClient />
    </div>
  );
}
