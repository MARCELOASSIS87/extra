import { z } from "zod";
import type { JobRole } from "../types/job.js";

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

export const jobPostSchema = z.object({
  role: jobRoleSchema,
  title: screenedText(z.string().trim().min(1, "Informe o título da vaga")),
  description: screenedText(z.string().trim().min(1, "Descreva a vaga")),
  date: z.iso.date("Data inválida"),
  startTime: timeSchema,
  endTime: timeSchema,
  payAmount: z.number().positive("Informe um valor maior que zero"),
  payNote: z.string().trim().min(1).nullable(),
  address: z.string().trim().min(1, "Informe o endereço"),
  neighborhood: z.string().trim().min(1, "Informe o bairro"),
  // Cidade não entra no formulário: MVP de cidade única, atribuída pelo servidor.
  requirements: screenedText(z.string().trim().min(1)).nullable(),
  vacancies: z.number().int().positive("Informe ao menos 1 vaga"),
  contactPhone: z
    .string()
    .regex(
      /^\+[1-9]\d{7,14}$/,
      "Telefone deve estar no formato internacional (+55...)",
    ),
});

export type JobPostInput = z.infer<typeof jobPostSchema>;
