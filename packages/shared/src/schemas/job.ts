import { z } from "zod";
import { nextCalendarDay, saoPauloToUtc } from "../lib/datetime";
import { cityIdSchema, citySlugSchema } from "./city";
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

/**
 * Explica e ensina o que fazer; não acusa ninguém. Quem escreve "moça" quase
 * sempre está repetindo o anúncio que sempre viu, não discriminando de caso
 * pensado — e uma mensagem acusatória faz a empresa fechar a aba em vez de
 * reescrever a vaga.
 */
export const DISCRIMINATORY_MESSAGE =
  "Anúncios de vaga não podem exigir sexo, idade ou aparência (art. 373-A da CLT). Reescreva descrevendo a função e os requisitos técnicos.";

export function hasDiscriminatoryLanguage(text: string): boolean {
  return DISCRIMINATORY_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * O que casou, em texto — "moça", "boa aparência". A rota guarda isso em
 * `blocked_job_attempts`: registrar a tentativa bloqueada é prova de
 * diligência (§14.1), e prova precisa dizer o que foi bloqueado, não só que
 * algo foi.
 *
 * Mora aqui, junto dos padrões, e não na rota: duas listas de expressões é
 * como uma delas para de acompanhar a outra.
 */
export function discriminatoryMatches(...texts: (string | null | undefined)[]) {
  const found = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const pattern of DISCRIMINATORY_PATTERNS) {
      const match = pattern.exec(text);
      if (match) found.add(match[0].toLowerCase());
    }
  }
  return [...found];
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
  requirements: screenedText(z.string().trim().min(1)).nullable(),
  /**
   * ONDE O TRABALHO ACONTECE, e não onde a empresa está registrada. Um buffet
   * de Poços atende formatura em Andradas o tempo todo, e é esta cidade — não
   * a do CNPJ — que decide quem recebe o aviso (§16.2) e qual página o Google
   * indexa (/vagas/[cidade]/[slug]). Vaga na cidade errada notifica as
   * pessoas erradas e ninguém descobre o porquê.
   *
   * Id vindo da tabela `cities`, nunca texto digitado (§7.1). A rota confere
   * contra o banco: id bem-formado que não existe é 400.
   */
  cityId: cityIdSchema,
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

/** Tamanho fixo da página pública. A query de §8 não tem `pageSize`. */
export const JOBS_PAGE_SIZE = 20;

/**
 * Query de `GET /v1/jobs` (§8). Não é o mesmo que `jobFiltersSchema`: aqui
 * `city` é o SLUG (o que vem na URL) e `from`/`to` são instantes em UTC. A
 * conversão para America/Sao_Paulo é do front — a API não sabe fuso.
 *
 * `city` não tem `.catch(undefined)` de propósito, e é a única diferença que
 * importa: slug errado tem que virar 404 na rota. Cair para "sem filtro"
 * devolveria vaga de outra cidade, e cair para "lista vazia" faria quem
 * digitou errado concluir que não há vaga ali.
 */
export const publicJobsQuerySchema = z.object({
  city: citySlugSchema.optional(),
  role: jobRoleSchema.optional().catch(undefined),
  from: z.iso.datetime().optional().catch(undefined),
  to: z.iso.datetime().optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
});

export type PublicJobsQuery = z.infer<typeof publicJobsQuerySchema>;
