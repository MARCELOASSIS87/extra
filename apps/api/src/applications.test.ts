import assert from "node:assert/strict";

/**
 * As seis travas de candidatura, contato e lista de candidatos (§16.5 e a
 * seção Segurança do CLAUDE.md).
 *
 * Duas delas guardam a rota mais perigosa do sistema — a única que revela um
 * telefone. As outras guardam o teto de candidaturas, que é a defesa contra a
 * empresa receber dezoito mensagens por anúncio e cancelar a assinatura.
 */
process.env.WHATSAPP_BUSINESS_NUMBER ??= "5535999999999";

const { prisma } = await import("./db.js");
const { buildServer } = await import("./server.js");
const { signSessionToken } = await import("./auth/token.js");
const { maxApplicationsFor } = await import("@extra/shared/lib/job");

const PHONE_PREFIX = "+5535944";
const DOCUMENT_PREFIX = "8800000000";
const CPF_PREFIX = "880";
const POCOS = "3151800";

const app = buildServer();
await app.ready();

async function cleanup(): Promise<void> {
  await prisma.company.deleteMany({
    where: { document: { startsWith: DOCUMENT_PREFIX } },
  });
  await prisma.worker.deleteMany({
    where: { cpf: { startsWith: CPF_PREFIX } },
  });
  await prisma.account.deleteMany({
    where: { phone: { startsWith: PHONE_PREFIX } },
  });
}

interface Actor {
  id: string;
  token: string;
  phone: string;
}

let seq = 0;
const nextPhone = () => `${PHONE_PREFIX}${String(++seq).padStart(5, "0")}`;

async function makeCompany(): Promise<Actor> {
  const phone = nextPhone();
  const account = await prisma.account.create({
    data: { phone, phoneVerifiedAt: new Date() },
  });
  const company = await prisma.company.create({
    data: {
      accountId: account.id,
      document: `${DOCUMENT_PREFIX}${String(seq).padStart(4, "0")}`.slice(
        0,
        14,
      ),
      legalName: `Empresa ${seq} LTDA`,
      tradeName: `Teste ${seq}`,
      responsibleName: "Fulano de Teste",
      email: `empresa${seq}@example.com`,
      cityId: POCOS,
      subscriptionStatus: "active",
    },
  });
  return {
    id: company.id,
    token: await signSessionToken(account.id, 1),
    phone,
  };
}

/** Perfil INCOMPLETO de propósito: candidatar-se não depende de completar. */
async function makeWorker(): Promise<Actor> {
  const phone = nextPhone();
  const account = await prisma.account.create({
    data: { phone, phoneVerifiedAt: new Date() },
  });
  const worker = await prisma.worker.create({
    data: {
      accountId: account.id,
      firstName: `Trabalhador${seq}`,
      lastName: "de Teste",
      cpf: `${CPF_PREFIX}${String(seq).padStart(8, "0")}`,
      birthDate: new Date("1990-05-20"),
      cityId: POCOS,
      neighborhood: "Centro",
      experience: "Experiência de teste.",
      status: "incomplete",
      termsVersion: "v1",
      termsAcceptedAt: new Date(),
      termsAcceptedIp: "127.0.0.1",
    },
  });
  return { id: worker.id, token: await signSessionToken(account.id, 1), phone };
}

async function makeJob(company: Actor, vacancies: number): Promise<string> {
  seq += 1;
  const startsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const job = await prisma.jobPost.create({
    data: {
      companyId: company.id,
      cityId: POCOS,
      slug: `vaga-de-teste-22c-${seq}`,
      role: "garcom",
      title: "Garçom para teste",
      description: "Vaga criada pelo teste automático.",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 4 * 60 * 60 * 1000),
      payAmount: 150,
      address: "Rua de Teste, 1",
      neighborhood: "Centro",
      vacancies,
      expiresAt: startsAt,
    },
  });
  return job.id;
}

const apply = (worker: Actor, jobId: string) =>
  app.inject({
    method: "POST",
    url: `/v1/jobs/${jobId}/applications`,
    headers: { authorization: `Bearer ${worker.token}` },
  });

const contact = (company: Actor, applicationId: string) =>
  app.inject({
    method: "GET",
    url: `/v1/applications/${applicationId}/contact`,
    headers: { authorization: `Bearer ${company.token}` },
  });

const countOf = (jobId: string) =>
  prisma.jobPost
    .findUniqueOrThrow({
      where: { id: jobId },
      select: { applicationsCount: true },
    })
    .then((job) => job.applicationsCount);

/**
 * a) Empresa A pedindo o contato de uma candidatura da empresa B: 404, e
 * `contactedAt` continua nulo. É a trava que separa "classificado" de "lista
 * telefônica pública".
 */
async function testForeignContactIs404(): Promise<void> {
  const owner = await makeCompany();
  const stranger = await makeCompany();
  const worker = await makeWorker();

  const jobId = await makeJob(owner, 2);
  const applied = await apply(worker, jobId);
  assert.equal(applied.statusCode, 201);
  const applicationId = applied.json().data.id;

  const response = await contact(stranger, applicationId);

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "not_found");
  // E nada no corpo pode conter o telefone, nem por acidente.
  assert.doesNotMatch(response.body, /\+55/);

  const after = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { contactedAt: true },
  });
  assert.equal(after.contactedAt, null, "a recusa não pode marcar contactedAt");
}

/** b) Candidatar duas vezes: 409, e o contador sobe só uma vez. */
async function testDuplicateApplication(): Promise<void> {
  const company = await makeCompany();
  const worker = await makeWorker();
  const jobId = await makeJob(company, 2);

  assert.equal((await apply(worker, jobId)).statusCode, 201);
  const second = await apply(worker, jobId);

  assert.equal(second.statusCode, 409);
  assert.equal(second.json().error.code, "already_applied");
  assert.equal(
    await countOf(jobId),
    1,
    "a duplicata não pode subir o contador",
  );
}

/** c) Teto atingido: 409, e o contador nunca passa de vacancies * 3. */
async function testCapIsEnforced(): Promise<void> {
  const company = await makeCompany();
  const jobId = await makeJob(company, 1);
  const cap = maxApplicationsFor(1);

  for (let index = 0; index < cap; index += 1) {
    const worker = await makeWorker();
    assert.equal((await apply(worker, jobId)).statusCode, 201);
  }

  const extra = await makeWorker();
  const response = await apply(extra, jobId);

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "applications_full");
  assert.equal(await countOf(jobId), cap, `o contador parou em ${cap}`);
}

/**
 * d) Duas candidaturas na ÚLTIMA vaga, disparadas de verdade em paralelo.
 * Uma passa, a outra é 409, e o contador fecha exato no teto. Sem o CHECK no
 * banco as duas leem o mesmo número e as duas passam.
 */
async function testConcurrentLastSlot(): Promise<void> {
  const company = await makeCompany();
  const jobId = await makeJob(company, 1);
  const cap = maxApplicationsFor(1);

  for (let index = 0; index < cap - 1; index += 1) {
    const worker = await makeWorker();
    assert.equal((await apply(worker, jobId)).statusCode, 201);
  }

  // Os dois trabalhadores nascem ANTES: criá-los dentro do Promise.all faria
  // o paralelo disputar o contador do CPF do próprio teste, e não a última
  // vaga. O que precisa correr junto são as duas candidaturas.
  const one = await makeWorker();
  const other = await makeWorker();
  const [first, second] = await Promise.all([
    apply(one, jobId),
    apply(other, jobId),
  ]);

  const codes = [first.statusCode, second.statusCode].sort();
  assert.deepEqual(
    codes,
    [201, 409],
    `esperava uma passar e uma falhar, veio ${codes.join(" e ")}`,
  );
  assert.equal(await countOf(jobId), cap, "o contador tem que fechar no teto");

  const stored = await prisma.application.count({
    where: { jobPostId: jobId },
  });
  assert.equal(stored, cap, "candidatura gravada sem contador é pior que 409");
}

/** e) Contato chamado duas vezes: a primeira data não é reescrita. */
async function testContactIsIdempotent(): Promise<void> {
  const company = await makeCompany();
  const worker = await makeWorker();
  const jobId = await makeJob(company, 2);
  const applicationId = (await apply(worker, jobId)).json().data.id;

  const first = await contact(company, applicationId);
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().data.phone, worker.phone);

  const second = await contact(company, applicationId);
  assert.equal(second.statusCode, 200);
  assert.equal(
    second.json().data.contactedAt,
    first.json().data.contactedAt,
    "a data da escolha é a da primeira vez, sempre",
  );
}

/**
 * f) O payload de candidatos não pode conter cpf, birthDate nem telefone.
 * Procurado por CHAVE no JSON cru, e não pelo tipo: o tipo é o que se acredita
 * estar enviando, o JSON é o que vai no fio.
 */
async function testApplicantsPayloadHasNoSecrets(): Promise<void> {
  const company = await makeCompany();
  const worker = await makeWorker();
  const jobId = await makeJob(company, 2);
  await apply(worker, jobId);

  const response = await app.inject({
    method: "GET",
    url: `/v1/jobs/${jobId}/applicants`,
    headers: { authorization: `Bearer ${company.token}` },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json().data;
  assert.equal(body.job.id, jobId);
  assert.equal(body.candidates.length, 1);
  assert.equal(body.candidates[0].worker.id, worker.id);

  // `fullName` NÃO entra na lista: a empresa dona da vaga vê o nome de quem se
  // candidatou a ela (§16.5, `WorkerApplicantProfile`). O que não pode sair
  // daqui é telefone, CPF e data de nascimento.
  const forbidden = [
    "cpf",
    "birthDate",
    "birth_date",
    "phone",
    "telefone",
    "accountId",
  ];
  const keys = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) return void value.forEach(walk);
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        keys.add(key);
        walk(child);
      }
    }
  };
  walk(body);

  for (const key of forbidden) {
    assert.ok(!keys.has(key), `a chave "${key}" não pode existir no payload`);
  }
  // O valor também não, caso apareça sob outro nome.
  assert.doesNotMatch(response.body, /\+55/, "telefone no corpo da resposta");
  assert.doesNotMatch(
    response.body,
    new RegExp(CPF_PREFIX + "\\d{8}"),
    "CPF no corpo da resposta",
  );
}

const tests: Array<[string, () => Promise<void>]> = [
  ["contato de candidatura alheia responde 404", testForeignContactIs404],
  ["candidatura duplicada: 409 e contador intacto", testDuplicateApplication],
  ["teto atingido: 409 e contador no limite", testCapIsEnforced],
  ["duas na última vaga em paralelo: uma só passa", testConcurrentLastSlot],
  ["contato duas vezes: contactedAt não muda", testContactIsIdempotent],
  [
    "payload de candidatos sem cpf, nascimento ou telefone",
    testApplicantsPayloadHasNoSecrets,
  ],
];

try {
  for (const [name, run] of tests) {
    await cleanup();
    await run();
    console.log(`ok — ${name}`);
  }
  console.log(`\nok — ${tests.length} testes de candidatura e contato`);
} finally {
  await cleanup();
  await app.close();
  await prisma.$disconnect();
}
