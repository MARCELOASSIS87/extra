import assert from "node:assert/strict";
import {
  workerStep1IdentitySchema,
  workerStep2PhoneSchema,
  workerStep4ProfileSchema,
  workerStep6ReferencesSchema,
} from "./worker.js";
import { jobPostSchema, hasDiscriminatoryLanguage } from "./job.js";
import { companyRegistrationSchema } from "./company.js";

const yearsAgo = (years: number): string => {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
};

// --- Etapa 1: identidade, CPF e idade mínima (§14.2) ---
assert.equal(
  workerStep1IdentitySchema.safeParse({
    fullName: "Maria Silva",
    cpf: "111.444.777-35",
    birthDate: yearsAgo(20),
  }).success,
  true,
);
assert.equal(
  workerStep1IdentitySchema.safeParse({
    fullName: "Maria Silva",
    cpf: "111.444.777-36", // dígito verificador errado
    birthDate: yearsAgo(20),
  }).success,
  false,
);
assert.equal(
  workerStep1IdentitySchema.safeParse({
    fullName: "Maria Silva",
    cpf: "111.444.777-35",
    birthDate: yearsAgo(17),
  }).success,
  false,
);

// --- Etapa 2: telefone E.164 ---
assert.equal(
  workerStep2PhoneSchema.safeParse({ phone: "+5511987654321" }).success,
  true,
);
assert.equal(
  workerStep2PhoneSchema.safeParse({ phone: "5511987654321" }).success,
  false,
);

// --- Etapa 4: perfil ---
assert.equal(
  workerStep4ProfileSchema.safeParse({
    roles: ["garcom"],
    experience: "3 anos em eventos",
    availability: [{ weekday: 6, period: "night" }],
    neighborhood: "Centro",
  }).success,
  true,
);
assert.equal(
  workerStep4ProfileSchema.safeParse({
    roles: ["astronauta"],
    experience: "x",
    availability: [{ weekday: 6, period: "night" }],
    neighborhood: "Centro",
  }).success,
  false,
);

// --- Etapa 6: exatamente duas referências ---
const reference = {
  name: "João",
  phone: "+5511999999999",
  relationship: "ex-patrão",
};
assert.equal(
  workerStep6ReferencesSchema.safeParse({ references: [reference, reference] })
    .success,
  true,
);
assert.equal(
  workerStep6ReferencesSchema.safeParse({ references: [reference] }).success,
  false,
);

// --- Filtro de linguagem discriminatória (§14.1) ---
assert.equal(
  hasDiscriminatoryLanguage("Precisa-se de moça para recepção"),
  true,
);
assert.equal(hasDiscriminatoryLanguage("Vaga para até 25 anos"), true);
assert.equal(hasDiscriminatoryLanguage("Vaga apenas homens"), true);
assert.equal(hasDiscriminatoryLanguage("Contratamos apenas brancos"), true);
assert.equal(
  hasDiscriminatoryLanguage("Somente solteiras podem se candidatar"),
  true,
);
assert.equal(
  hasDiscriminatoryLanguage("Precisamos de garçom para evento de sábado"),
  false,
);

const validJob = {
  role: "garcom" as const,
  title: "Garçom para formatura",
  description: "Atender mesas em formatura no sábado à noite",
  date: "2026-09-05",
  startTime: "18:00",
  endTime: "23:30",
  payAmount: 150,
  payNote: null,
  address: "Rua das Flores, 100",
  neighborhood: "Centro",
  requirements: "Uniforme preto e social",
  vacancies: 3,
  contactPhone: "+5511987654321",
};
assert.equal(jobPostSchema.safeParse(validJob).success, true);
assert.equal(
  jobPostSchema.safeParse({ ...validJob, title: "Moça para garçonete" })
    .success,
  false,
);
assert.equal(
  jobPostSchema.safeParse({
    ...validJob,
    requirements: "Apenas mulheres solteiras",
  }).success,
  false,
);
assert.equal(
  jobPostSchema.safeParse({ ...validJob, payAmount: -10 }).success,
  false,
);
assert.equal(
  jobPostSchema.safeParse({ ...validJob, requirements: null }).success,
  true,
);

// --- Cadastro da empresa: CNPJ, e-mail ---
const validCompany = {
  cnpj: "11.222.333/0001-81",
  legalName: "Buffet Silva LTDA",
  tradeName: "Buffet Silva",
  responsibleName: "Ana Silva",
  phone: "+5511987654321",
  email: "contato@buffetsilva.com.br",
  termsAccepted: true,
};
assert.equal(companyRegistrationSchema.safeParse(validCompany).success, true);
assert.equal(
  companyRegistrationSchema.safeParse({
    ...validCompany,
    cnpj: "11.222.333/0001-82",
  }).success,
  false,
);
assert.equal(
  companyRegistrationSchema.safeParse({ ...validCompany, email: "nao-e-email" })
    .success,
  false,
);
assert.equal(
  companyRegistrationSchema.safeParse({
    ...validCompany,
    termsAccepted: false,
  }).success,
  false,
);

console.log("schemas.test.ts: all checks passed");
