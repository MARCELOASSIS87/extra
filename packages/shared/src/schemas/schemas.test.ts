import assert from "node:assert/strict";
import {
  workerStep1IdentitySchema,
  workerStep2PhoneSchema,
  workerStep4ProfileSchema,
  workerTermsAcceptanceSchema,
} from "./worker";
import { jobPostSchema, hasDiscriminatoryLanguage } from "./job";
import { companyRegistrationSchema } from "./company";
import { CURRENT_TERMS_VERSION } from "../constants/terms";
import { nextCalendarDay, saoPauloDate, saoPauloTime } from "../lib/datetime";

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

// --- Máximo de 5 funções (§7.3) ---
const profileWith = (roles: string[]) => ({
  roles,
  experience: "3 anos em eventos",
  availability: [{ weekday: 6, period: "night" }],
  neighborhood: "Centro",
});
assert.equal(
  workerStep4ProfileSchema.safeParse(
    profileWith([
      "garcom",
      "barman",
      "cozinheiro",
      "seguranca",
      "recepcionista",
    ]),
  ).success,
  true,
);
assert.equal(
  workerStep4ProfileSchema.safeParse(
    profileWith([
      "garcom",
      "barman",
      "cozinheiro",
      "seguranca",
      "recepcionista",
      "motorista",
    ]),
  ).success,
  false,
  "seis funções não passam",
);

// --- Aceite do termo é etapa própria, e recusar não passa ---
assert.equal(
  workerTermsAcceptanceSchema.safeParse({
    termsVersion: CURRENT_TERMS_VERSION,
    termsAccepted: true,
  }).success,
  true,
);
assert.equal(
  workerTermsAcceptanceSchema.safeParse({
    termsVersion: CURRENT_TERMS_VERSION,
    termsAccepted: false,
  }).success,
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

// --- Data e hora viram instantes em UTC (§7.5) ---
// Poços está em UTC-3: 19h de sábado é 22:00Z do mesmo dia.
const sameDay = jobPostSchema.parse(validJob);
assert.equal(sameDay.startsAt, "2026-09-05T21:00:00.000Z");
assert.equal(sameDay.endsAt, "2026-09-06T02:30:00.000Z");
assert.ok(
  !("date" in sameDay) && !("startTime" in sameDay),
  "o contrato guarda instante, não data e hora soltas",
);

// Formatura entra 19h e sai 1h: o fim cai no dia seguinte, e a duração
// continua positiva — era exatamente o que três campos separados erravam.
const overnight = jobPostSchema.parse({
  ...validJob,
  date: "2026-08-20",
  startTime: "19:00",
  endTime: "01:00",
});
assert.equal(overnight.startsAt, "2026-08-20T22:00:00.000Z");
assert.equal(overnight.endsAt, "2026-08-21T04:00:00.000Z");
assert.ok(overnight.endsAt > overnight.startsAt, "duração nunca é negativa");

// O dia do calendário em Poços é o que a listagem filtra: 23h do dia 20 é
// 02:00Z do dia 21 em UTC, e ainda assim é uma vaga do dia 20.
assert.equal(saoPauloDate("2026-08-21T02:00:00.000Z"), "2026-08-20");
assert.equal(saoPauloDate(overnight.startsAt), "2026-08-20");
assert.equal(saoPauloTime(overnight.endsAt), "01:00");
assert.equal(nextCalendarDay("2026-12-31"), "2027-01-01");

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
