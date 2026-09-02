import { z } from "zod";

/**
 * Motivos fechados (§14.4). Enum, e não texto: a moderação precisa contar e
 * agrupar, e categoria digitada não agrupa.
 */
export const reportReasonSchema = z.enum([
  "discriminatory_content",
  "fake_job",
  "fake_profile",
  "offensive_content",
  "other",
]);

export type ReportReason = z.infer<typeof reportReasonSchema>;

/**
 * Denúncia de uma vaga OU de um perfil — exatamente um alvo.
 *
 * O `refine` existe mesmo havendo o CHECK `reports_exactly_one_target` no
 * banco: o banco é a rede de segurança, não a mensagem de erro. Sem isto,
 * zero ou dois alvos viram 500 genérico em vez de 400 explicando o que fazer.
 *
 * `details` é texto livre, e não contradiz a regra 5: ali quem escreve é o
 * DENUNCIANTE, descrevendo um anúncio ou um comportamento para a moderação
 * ler. O que a regra 5 proíbe é texto de EMPRESA avaliando trabalhador em
 * `attendance_records` — avaliação que vira histórico público. São coisas
 * diferentes: uma é denúncia, com destinatário e prazo; a outra seria nota.
 */
export const reportCreateSchema = z
  .object({
    targetJobPostId: z.uuid().nullish(),
    targetWorkerId: z.uuid().nullish(),
    reason: reportReasonSchema,
    details: z.string().trim().min(1).max(2000).nullish(),
  })
  .refine(
    (value) =>
      Number(Boolean(value.targetJobPostId)) +
        Number(Boolean(value.targetWorkerId)) ===
      1,
    {
      message: "Informe exatamente um alvo: uma vaga ou um perfil.",
      path: ["targetJobPostId"],
    },
  );

export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
