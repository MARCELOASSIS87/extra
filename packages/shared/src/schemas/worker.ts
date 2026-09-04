import { z } from "zod";
import { cityIdSchema, workerNotificationPreferencesSchema } from "./city";
import { jobRoleSchema } from "./job";
import { phoneE164Schema } from "./phone";

const MIN_AGE = 18;

function isValidCpf(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const checkDigit = (base: string, startFactor: number): number => {
    let total = 0;
    let factor = startFactor;
    for (const digit of base) total += Number(digit) * factor--;
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return (
    checkDigit(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    checkDigit(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

// Bloqueio de menores de 18 anos no cadastro (ECA Digital, Lei 15.211/2025) — §14.2.
function isAdult(birthDate: string): boolean {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthdayThisYear =
    today.getUTCMonth() > birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() &&
      today.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthdayThisYear) age--;
  return age >= MIN_AGE;
}

/** Máximo de 5 funções por trabalhador (§7.3). */
export const MAX_WORKER_ROLES = 5;

const rolesSchema = z
  .array(jobRoleSchema)
  .min(1, "Selecione ao menos uma função")
  .max(MAX_WORKER_ROLES, `Selecione no máximo ${MAX_WORKER_ROLES} funções`);

// Etapa 1 — Nome + CPF + data de nascimento (§16.1).
export const workerStep1IdentitySchema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo"),
  cpf: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine(isValidCpf, "CPF inválido"),
  birthDate: z.iso
    .date("Data de nascimento inválida")
    .refine(isAdult, "Cadastro permitido apenas para maiores de 18 anos"),
});
export type WorkerStep1Identity = z.infer<typeof workerStep1IdentitySchema>;

// Etapa 2 — Telefone (verificado depois via WhatsApp, §11).
export const workerStep2PhoneSchema = z.object({
  phone: phoneE164Schema,
});
export type WorkerStep2Phone = z.infer<typeof workerStep2PhoneSchema>;

// Etapa 3 — Selfie com documento. O upload vai direto pro MinIO via URL
// pré-assinada; o schema só valida a chave do objeto já enviado.
export const workerStep3DocumentSchema = z.object({
  documentSelfieKey: z.string().min(1, "Envie a selfie com documento"),
});
export type WorkerStep3Document = z.infer<typeof workerStep3DocumentSchema>;

const availabilitySchema = z.object({
  weekday: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  period: z.enum(["morning", "afternoon", "night"]),
});

// Etapa 4 — Perfil: funções, experiência, disponibilidade, bairro (§16.1).
export const workerStep4ProfileSchema = z.object({
  roles: rolesSchema,
  experience: z.string().trim().min(1, "Descreva sua experiência"),
  availability: z
    .array(availabilitySchema)
    .min(1, "Informe ao menos uma disponibilidade"),
  neighborhood: z.string().trim().min(1, "Informe o bairro"),
});
export type WorkerStep4Profile = z.infer<typeof workerStep4ProfileSchema>;

// Etapa — Aceite do termo de uso. Etapa própria porque o consentimento é
// prova, não caixinha no rodapé de outra tela. A data e o IP quem carimba é o
// servidor: o cliente não sabe o próprio IP e não deveria escolher a hora.
export const workerTermsAcceptanceSchema = z.object({
  termsVersion: z.string().min(1, "Versão do termo não informada"),
  // `boolean` com refine, e não `literal(true)`: o formulário precisa de
  // um valor inicial `false`, mesmo padrão do cadastro da empresa.
  termsAccepted: z
    .boolean()
    .refine((value) => value, "É preciso aceitar os termos de uso"),
});
export type WorkerTermsAcceptance = z.infer<typeof workerTermsAcceptanceSchema>;

// Etapa final — Vídeo de 30s de apresentação (bucket público). OPCIONAL: é
// ele que dá o selo de perfil completo, e quem não grava recebe vaga do mesmo
// jeito (§16.1). `null` é "não quero gravar", uma escolha, não um campo vazio.
export const workerStep5VideoSchema = z.object({
  introVideoKey: z.string().min(1).nullable(),
});
export type WorkerStep5Video = z.infer<typeof workerStep5VideoSchema>;

// PATCH /v1/workers/me — cadastro salva etapa a etapa (§16.1), então a
// atualização é sempre parcial. A etapa 1 (nome/CPF/nascimento) não entra:
// identidade não se reescreve por PATCH.
export const workerProfileUpdateSchema = workerStep2PhoneSchema
  .extend(workerStep3DocumentSchema.shape)
  .extend(workerStep4ProfileSchema.shape)
  .extend(workerStep5VideoSchema.shape)
  .extend(workerTermsAcceptanceSchema.shape)
  // Cidades de aviso e raio: editáveis em "meu perfil" (§16.2). O PATCH é
  // sempre parcial, então a tela manda só o que mudou.
  .extend(workerNotificationPreferencesSchema.shape)
  .partial();
export type WorkerProfileUpdate = z.infer<typeof workerProfileUpdateSchema>;

// Cadastro reduzido — destino do muro do botão "Quero essa vaga" quando quem
// clica não está autenticado como trabalhador. Nome, telefone, funções e
// bairro; sem CPF, selfie e sem vídeo — isso fica para as etapas completas do
// §16.1. Mesmo reduzido, mantém o bloqueio de menor de 18 anos e o aceite do
// termo: não existe cadastro sem consentimento registrado.
export const workerQuickRegistrationSchema = z
  .object({
    fullName: z.string().trim().min(3, "Informe o nome completo"),
    phone: phoneE164Schema,
    birthDate: z.iso
      .date("Data de nascimento inválida")
      .refine(isAdult, "Cadastro permitido apenas para maiores de 18 anos"),
    roles: rolesSchema,
    // Onde mora: âncora do raio de vizinhança e contexto do bairro. Sem isto
    // o raio de quem é de fora ficaria ancorado na cidade errada.
    cityId: cityIdSchema,
    neighborhood: z.string().trim().min(1, "Informe o bairro"),
  })
  .extend(workerNotificationPreferencesSchema.shape)
  .extend(workerTermsAcceptanceSchema.shape);
export type WorkerQuickRegistrationInput = z.infer<
  typeof workerQuickRegistrationSchema
>;

/**
 * POST /v1/workers — o cadastro inteiro numa chamada só, montado das mesmas
 * etapas do §16.1. Composto, nunca reescrito: repetir aqui o CPF, a idade
 * mínima ou o teto de funções criaria uma segunda versão de cada regra, e é a
 * segunda versão que envelhece.
 *
 * O telefone NÃO entra: ele mora em `Account` e já foi provado no login (§7.2)
 * — reenviá-lo no corpo seria deixar o cliente escolher o próprio telefone.
 *
 * `termsAcceptedAt` e `termsAcceptedIp` também não: o cliente não sabe o
 * próprio IP e não deveria escolher a hora do consentimento. Quem carimba os
 * dois é o servidor, com o instante da requisição e `request.ip`.
 *
 * A selfie e o vídeo ficam de fora porque o upload é a tarefa 25 — quem chega
 * sem eles termina o cadastro do mesmo jeito, e é isso que a regra da casa
 * manda: nunca travar (§16.1).
 *
 * NÃO é o que `POST /v1/workers` exige — isso é `workerMinimalCreateSchema`,
 * abaixo. Este continua aqui, intacto, como a definição de "cadastro inteiro
 * numa chamada": afrouxá-lo para servir a criação em etapas apagaria a única
 * descrição que o repositório tem do conjunto completo.
 */
export const workerCreateSchema = workerStep1IdentitySchema
  .extend(workerStep4ProfileSchema.shape)
  .extend(workerTermsAcceptanceSchema.shape)
  .extend(workerNotificationPreferencesSchema.shape)
  .extend({
    // Onde mora: contexto do bairro e âncora do raio de vizinhança (§7.3).
    cityId: cityIdSchema,
  })
  .strict();

export type WorkerCreateInput = z.infer<typeof workerCreateSchema>;

/**
 * Query de `GET /v1/cities/:id/neighbors`. O raio é aberto aqui — a tela mostra
 * "50 km inclui 23 cidades" ANTES de a pessoa escolher, então ela precisa
 * poder perguntar por um valor que ainda não é o dela. O que é fechado em
 * 25|50 é o que se GRAVA, e isso `nearbyRadiusKmSchema` já garante.
 */
export const cityNeighborsQuerySchema = z.object({
  radiusKm: z.coerce
    .number()
    .int()
    .min(1, "Raio inválido")
    .max(100, "A vizinhança só vai até 100 km"),
});

/**
 * POST /v1/workers — o MÍNIMO para a pessoa existir: quem ela é, onde mora e
 * o aceite do termo. Nada além disso.
 *
 * O §16.1 promete progresso salvo a cada etapa, e progresso só se salva se a
 * primeira etapa puder ser gravada sozinha. Exigir funções, disponibilidade e
 * cidades de aviso na criação significa que uma queda de conexão na etapa 4
 * joga fora o CPF já digitado — que é exatamente o esforço que a promessa
 * existe para proteger.
 *
 * Separado de `workerCreateSchema` de propósito, e não derivado dele por
 * `.partial()`: um `.partial()` afrouxaria também o que precisa continuar
 * obrigatório quando o campo VEM. Aqui a lista é explícita, e o que entra
 * depois entra pelo PATCH, com as regras da etapa dele.
 *
 * O bairro entra junto porque é o par da cidade: cidade sem bairro não
 * localiza ninguém, e os dois saem da mesma tela.
 *
 * Status nasce `incomplete`, e `profileCompletedAt` fica nulo — o selo é o
 * vídeo, e ele nem foi pedido ainda.
 */
export const workerMinimalCreateSchema = workerStep1IdentitySchema
  .extend(workerTermsAcceptanceSchema.shape)
  .extend({
    cityId: cityIdSchema,
    neighborhood: z.string().trim().min(1, "Informe o bairro"),
  })
  .strict();

export type WorkerMinimalCreateInput = z.infer<
  typeof workerMinimalCreateSchema
>;
