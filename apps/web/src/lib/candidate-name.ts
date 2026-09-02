import type { WorkerApplicantProfile } from "@extra/shared/types/worker";

/**
 * Como o nome do candidato aparece antes e depois de a empresa chamar.
 *
 * O nome completo passa pelo MESMO portão do telefone (§16.5, regra 8): sai no
 * ato de escolher, não antes. Enquanto não sai, a tela mostra primeiro nome e
 * inicial — nunca fica sem nome nenhum, que é o que faria a empresa achar que
 * é bug e abrir chamado.
 *
 * Vive aqui, e não dentro de cada card, porque são três telas com a mesma
 * regra: lista de candidatos, detalhe do candidato e fila de presença. Três
 * cópias é como uma delas passa a mostrar o sobrenome cedo demais.
 */
export function candidateDisplayName(
  worker: Pick<
    WorkerApplicantProfile,
    "fullName" | "firstName" | "lastNameInitial"
  >,
): string {
  return (
    worker.fullName ??
    `${worker.firstName}${worker.lastNameInitial ? ` ${worker.lastNameInitial}` : ""}`
  );
}

/**
 * A linha discreta que explica a inicial. `null` depois do contato, quando o
 * nome completo já está na tela e a explicação vira ruído.
 */
export function candidateNameHint(
  worker: Pick<WorkerApplicantProfile, "fullName">,
): string | null {
  return worker.fullName
    ? null
    : "o nome completo aparece quando você chamar no WhatsApp";
}
