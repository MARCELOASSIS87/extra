import { z } from "zod";
import { jobRoleSchema } from "./job.js";

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

const phoneE164Schema = z
  .string()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    "Telefone deve estar no formato internacional (+55...)",
  );

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
// Cidade não entra aqui: MVP de cidade única, atribuída pelo servidor.
export const workerStep4ProfileSchema = z.object({
  roles: z.array(jobRoleSchema).min(1, "Selecione ao menos uma função"),
  experience: z.string().trim().min(1, "Descreva sua experiência"),
  availability: z
    .array(availabilitySchema)
    .min(1, "Informe ao menos uma disponibilidade"),
  neighborhood: z.string().trim().min(1, "Informe o bairro"),
});
export type WorkerStep4Profile = z.infer<typeof workerStep4ProfileSchema>;

// Etapa 5 — Vídeo de 30s de apresentação (bucket público).
export const workerStep5VideoSchema = z.object({
  introVideoKey: z.string().min(1, "Envie o vídeo de apresentação"),
});
export type WorkerStep5Video = z.infer<typeof workerStep5VideoSchema>;

const workerReferenceSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da referência"),
  phone: phoneE164Schema,
  relationship: z.string().trim().min(1, "Informe a relação com a referência"),
});

// Etapa 6 — Duas referências de trabalho anterior (§16.1).
export const workerStep6ReferencesSchema = z.object({
  references: z
    .array(workerReferenceSchema)
    .length(2, "Informe exatamente duas referências"),
});
export type WorkerStep6References = z.infer<typeof workerStep6ReferencesSchema>;
