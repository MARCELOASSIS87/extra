import { z } from "zod";
import { nextCalendarDay, saoPauloToUtc } from "../lib/datetime";
import { cityIdSchema } from "./city";
import type { JobReach, JobRole } from "../types/job";

const jobRoleValues = [
  "garcom",
  "cozinheiro",
  "auxiliar_cozinha",
  "auxiliar_limpeza",
  "diarista",
  "barman",
  "seguranca",
  "recepcionista",
  "montagem_evento",
  "motorista",
  "outro",
] as const satisfies readonly JobRole[];

export const jobRoleSchema = z.enum(jobRoleValues);

const jobReachValues = [
  "unrestricted",
  "nearby",
  "city_only",
] as const satisfies readonly JobReach[];

export const jobReachSchema = z.enum(jobReachValues);

/** Raios oferecidos no formulário. O teto real é o opt-in do trabalhador. */
export const JOB_REACH_RADIUS_OPTIONS = [25, 50] as const;

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (HH:mm)");

// §14.1 — bloqueia exigência de sexo, idade ou aparência (art. 373-A da CLT).
// Vale para o formulário e para a rota da API: o cliente é contornável.
const DISCRIMINATORY_PATTERNS: RegExp[] = [
  /\bmoça\b/i,
  /\bmoço\b/i,
  /\brapaz\b/i,
  /\bboa aparência\b/i,
  /\bboa apresentação\b/i,
  /\baté\s*\d+\s*anos\b/i,
  /\bsexo\s*(masculino|feminino)\b/i,
  /\bapenas\s*(homens|mulheres)\b/i,
  /\bsolteir[oa]s?\b/i,
  /\bsem filhos\b/i,
  // recortes raciais — exemplos de exigência explícita de raça/cor
  /\bapenas\s*(brancos?|negros?|pardos?|amarelos?)\b/i,
  /\bcor da pele\b/i,
  /\bpele clara\b/i,
];

const DISCRIMINATORY_MESSAGE =
  "Anúncios de vaga não podem exigir sexo, idade ou aparência (art. 373-A da CLT). Reescreva descrevendo a função e os requisitos técnicos.";

export function hasDiscriminatoryLanguage(text: string): boolean {
  return DISCRIMINATORY_PATTERNS.some((pattern) => pattern.test(text));
}

// Quem chama a rota registra a tentativa bloqueada em log (prova de diligência,
// §14.1) — o schema só valida, efeito colateral fica na camada da API.
const screenedText = (base: z.ZodString) =>
  base.refine(
    (value) => !hasDiscriminatoryLanguage(value),
    DISCRIMINATORY_MESSAGE,
  );

/**
 * O que o formulário preenche: data e as duas horas, do jeito que a empresa
 * pensa. Não é o que o contrato guarda — a montagem dos instantes é o
 * `.transform()` de `jobPostSchema`, logo abaixo.
 */
export const jobPostFormSchema = z.object({
  role: jobRoleSchema,
  title: screenedText(z.string().trim().min(1, "Informe o título da vaga")),
  description: screenedText(z.string().trim().min(1, "Descreva a vaga")),
  date: z.iso.date("Data inválida"),
  startTime: timeSchema,
  endTime: timeSchema,
  // Real inteiro: o valor combinado de um bico é redondo, e centavo na tela
  // só cria divergência entre o que a empresa digitou e o que o anúncio diz.
  payAmount: z
    .number()
    .int("Informe o valor em reais inteiros, sem centavos")
    .positive("Informe um valor maior que zero"),
  payNote: z.string().trim().min(1).nullable(),
  address: z.string().trim().min(1, "Informe o endereço"),
  neighborhood: z.string().trim().min(1, "Informe o bairro"),
  // Cidade não entra no formulário: a vaga herda a cidade da empresa, e o
  // servidor é quem preenche — texto digitado nunca vira cidade (§7.1).
  requirements: screenedText(z.string().trim().min(1)).nullable(),
  // Sem telefone: a direção do contato é única (§16.5) e quem chama é a
  // empresa, pelo painel, com o número que já está em `Company.phone`.
  vacancies: z.number().int().positive("Informe ao menos 1 vaga"),
  providesTransport: z.boolean(),
  reach: jobReachSchema,
  reachRadiusKm: z.number().int().positive().nullable(),
});

export type JobPostFormInput = z.infer<typeof jobPostFormSchema>;

/**
 * O contrato: três campos do formulário viram dois instantes em UTC (§7.5).
 * Fica no schema compartilhado, não no componente, porque a rota da API
 * precisa da mesma montagem — cliente é contornável.
 *
 * Hora de fim menor que a de início significa que o bico vira a noite. Isso é
 * caso normal, não erro: formatura entra às 22h e sai às 2h. Era exatamente
 * o que três campos separados erravam — duração negativa e expiração no dia
 * errado.
 */
export const jobPostSchema = jobPostFormSchema
  .refine((value) => value.reach !== "nearby" || value.reachRadiusKm !== null, {
    message: "Escolha o raio em quilômetros",
    path: ["reachRadiusKm"],
  })
  .transform(({ date, startTime, endTime, ...rest }) => {
    const startsAt = saoPauloToUtc(date, startTime);
    const endDate = endTime <= startTime ? nextCalendarDay(date) : date;
    return {
      ...rest,
      // Raio só existe em 'nearby'. Normalizar aqui, em vez de recusar, tira
      // a combinação inválida do banco sem transformar troca de opção em erro.
      reachRadiusKm: rest.reach === "nearby" ? rest.reachRadiusKm : null,
      startsAt,
      endsAt: saoPauloToUtc(endDate, endTime),
    };
  });

export type JobPostInput = z.infer<typeof jobPostSchema>;

export const MAX_JOB_PAGE_SIZE = 50;

/**
 * Filtros da listagem pública, vindos da query string (§8) — logo, entrada de
 * fora. Cada campo tem `.catch(undefined)` de propósito: link velho ou colado
 * pela metade não pode derrubar a busca inteira, só o filtro estragado.
 */
export const jobFiltersSchema = z.object({
  role: jobRoleSchema.optional().catch(undefined),
  cityId: cityIdSchema.optional().catch(undefined),
  neighborhood: z.string().trim().min(1).optional().catch(undefined),
  date: z.iso.date().optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_JOB_PAGE_SIZE)
    .optional()
    .catch(undefined),
});

export type JobFiltersInput = z.infer<typeof jobFiltersSchema>;
