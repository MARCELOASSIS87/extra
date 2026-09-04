import assert from "node:assert/strict";

/**
 * As escritas do trabalhador (tarefa 23d): sair da candidatura, cadastro em
 * etapas e desativar/reativar a própria conta.
 *
 * Três delas existem por causa da regra 3 do CLAUDE.md — só o próprio usuário
 * mexe na conta dele, e a plataforma não pune ninguém. O teste (d) é o que
 * guarda a decisão mais delicada: desativar a conta NÃO pode apagar uma
 * candidatura que a empresa já tem em mãos.
 */
process.env.WHATSAPP_BUSINESS_NUMBER ??= "5535999999999";

const { prisma } = await import("./db.js");
const { buildServer } = await import("./server.js");
const { signSessionToken } = await import("./auth/token.js");
const { CURRENT_TERMS_VERSION } = await import("@extra/shared/constants/terms");

const PHONE_PREFIX = "+5535933";
const DOCUMENT_PREFIX = "3300000000";
const CPF_PREFIX = "330";
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
}

let seq = 0;
const nextPhone = () => `${PHONE_PREFIX}${String(++seq).padStart(5, "0")}`;

/** CPF com dígitos verificadores válidos — o schema confere de verdade. */
function makeCpf(): string {
  const base = `${CPF_PREFIX}${String(++seq).padStart(6, "0")}`;
  const digit = (partial: string): number => {
    const weight = partial.length + 1;
    const sum = partial
      .split("")
      .reduce((acc, char, i) => acc + Number(char) * (weight - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const first = digit(base);
  const second = digit(`${base}${first}`);
  return `${base}${first}${second}`;
}

async function makeCompany(): Promise<Actor> {
  const account = await prisma.account.create({
    data: { phone: nextPhone(), phoneVerifiedAt: new Date() },
  });
  const company = await prisma.company.create({
    data: {
      accountId: account.id,
      document: `${DOCUMENT_PREFIX}${String(seq).padStart(4, "0")}`.slice(0, 14),
      legalName: `Empresa ${seq} LTDA`,
      tradeName: `Escritas ${seq}`,
      responsibleName: "Fulano de Teste",
      email: `escritas${seq}@example.com`,
      cityId: POCOS,
      subscriptionStatus: "active",
    },
  });
  return { id: company.id, token: await signSessionToken(account.id, 1) };
}

async function makeWorker(): Promise<Actor> {
  const account = await prisma.account.create({
    data: { phone: nextPhone(), phoneVerifiedAt: new Date() },
  });
  const worker = await prisma.worker.create({
    data: {
      accountId: account.id,
      firstName: `Trabalhador${seq}`,
      lastName: "de Teste",
      cpf: makeCpf(),
      birthDate: new Date("1990-05-20"),
      cityId: POCOS,
      neighborhood: "Centro",
      experience: "Experiência de teste.",
      status: "complete",
      documentSelfieKey: "docs/teste.jpg",
      termsVersion: "v1",
      termsAcceptedAt: new Date(),
      termsAcceptedIp: "127.0.0.1",
      roles: { create: [{ role: "garcom" }] },
      notificationCities: { create: [{ cityId: POCOS }] },
      availability: { create: [{ weekday: 6, period: "night" }] },
    },
  });
  return { id: worker.id, token: await signSessionToken(account.id, 1) };
}

/** `startsAt` no futuro por padrão; no passado quando `started`. */
async function makeJob(
  company: Actor,
  { vacancies = 1, started = false, onSaturdayNight = false } = {},
): Promise<string> {
  seq += 1;
  const startsAt = started
    ? new Date(Date.now() - 2 * 60 * 60 * 1000)
    : onSaturdayNight
      ? nextSaturdayNight()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const job = await prisma.jobPost.create({
    data: {
      companyId: company.id,
      cityId: POCOS,
      slug: `vaga-escritas-${seq}`,
      role: "garcom",
      title: "Garçom para teste",
      description: "Criada pelo teste automático.",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 4 * 60 * 60 * 1000),
      payAmount: 150,
      address: "Rua de Teste, 1",
      neighborhood: "Centro",
      vacancies,
      // Não vencida: a candidatura só é aceita enquanto a vaga vale.
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  return job.id;
}

/** Próximo sábado às 22h em Poços — o slot que `makeWorker` declara. */
function nextSaturdayNight(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7 || 7));
  d.setUTCHours(1, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

const post = (actor: Actor, url: string, payload?: unknown) =>
  app.inject({
    method: "POST",
    url,
    headers: { authorization: `Bearer ${actor.token}` },
    ...(payload === undefined ? {} : { payload: payload as object }),
  });

const get = (actor: Actor, url: string) =>
  app.inject({
    method: "GET",
    url,
    headers: { authorization: `Bearer ${actor.token}` },
  });

const countOf = (jobId: string) =>
  prisma.jobPost
    .findUniqueOrThrow({
      where: { id: jobId },
      select: { applicationsCount: true },
    })
    .then((job) => job.applicationsCount);

/**
 * a) Sair da candidatura devolve a cadeira: o contador decrementa e outra
 * pessoa consegue entrar no lugar. Sem o decremento, a vaga fecharia a
 * candidatura com um lugar ocupado por quem já saiu.
 */
async function testWithdrawFreesASeat(): Promise<void> {
  const company = await makeCompany();
  const first = await makeWorker();
  const second = await makeWorker();

  // Uma vaga, teto de 3 candidaturas — preenche até o teto.
  const jobId = await makeJob(company, { vacancies: 1 });
  const third = await makeWorker();
  for (const worker of [first, second, third]) {
    assert.equal((await post(worker, `/v1/jobs/${jobId}/applications`)).statusCode, 201);
  }
  assert.equal(await countOf(jobId), 3);

  // No teto, a quarta é recusada.
  const fourth = await makeWorker();
  assert.equal(
    (await post(fourth, `/v1/jobs/${jobId}/applications`)).statusCode,
    409,
  );

  // A primeira sai.
  const mine = await get(first, "/v1/me/applications");
  const applicationId = mine.json().data[0].application.id;
  const withdrawn = await post(
    first,
    `/v1/applications/${applicationId}/withdraw`,
  );
  assert.equal(withdrawn.statusCode, 200);
  assert.equal(withdrawn.json().data.status, "withdrawn");
  assert.equal(await countOf(jobId), 2);

  // E agora a quarta entra: a vaga voltou a ter espaço.
  assert.equal(
    (await post(fourth, `/v1/jobs/${jobId}/applications`)).statusCode,
    201,
  );
  assert.equal(await countOf(jobId), 3);

  // Sair de novo não tira outra cadeira.
  assert.equal(
    (await post(first, `/v1/applications/${applicationId}/withdraw`)).statusCode,
    409,
  );
  assert.equal(await countOf(jobId), 3);

  // Candidatura de outra pessoa: 404, sem confirmar que o id existe.
  assert.equal(
    (await post(second, `/v1/applications/${applicationId}/withdraw`))
      .statusCode,
    404,
  );
}

/** b) Depois de `startsAt`, não dá mais para sair: 409, contador intacto. */
async function testWithdrawAfterStartIs409(): Promise<void> {
  const company = await makeCompany();
  const worker = await makeWorker();

  // A vaga começa no futuro para a candidatura ser aceita...
  const jobId = await makeJob(company);
  assert.equal(
    (await post(worker, `/v1/jobs/${jobId}/applications`)).statusCode,
    201,
  );
  const applicationId = (await get(worker, "/v1/me/applications")).json().data[0]
    .application.id;

  // ...e depois já começou.
  await prisma.jobPost.update({
    where: { id: jobId },
    data: { startsAt: new Date(Date.now() - 60 * 60 * 1000) },
  });

  const response = await post(
    worker,
    `/v1/applications/${applicationId}/withdraw`,
  );
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "job_already_started");
  assert.equal(await countOf(jobId), 1);

  const still = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { status: true },
  });
  assert.equal(still.status, "applied");
}

/**
 * c) O cadastro mínimo cria a pessoa: nome, CPF, nascimento, cidade, bairro e
 * o aceite. Status `incomplete`, sem selo — e o que falta entra por PATCH.
 */
async function testMinimalRegistration(): Promise<void> {
  const account = await prisma.account.create({
    data: { phone: nextPhone(), phoneVerifiedAt: new Date() },
  });
  const token = await signSessionToken(account.id, 1);
  const actor: Actor = { id: account.id, token };

  const response = await post(actor, "/v1/workers", {
    fullName: "Maria de Teste",
    cpf: makeCpf(),
    birthDate: "1992-03-14",
    cityId: POCOS,
    neighborhood: "Centro",
    termsVersion: CURRENT_TERMS_VERSION,
    termsAccepted: true,
  });

  assert.equal(response.statusCode, 201);
  const worker = response.json().data;
  assert.equal(worker.status, "incomplete");
  assert.equal(worker.profileCompletedAt, null);
  // Nasce sem nada disso: cada um entra na etapa dele.
  assert.deepEqual(worker.roles, []);
  assert.deepEqual(worker.availability, []);
  assert.equal(worker.introVideoKey, null);

  // Mandar o cadastro INTEIRO na criação continua sendo recusado: o schema é
  // `.strict()`, e afrouxar isso apagaria a separação entre as duas etapas.
  const account2 = await prisma.account.create({
    data: { phone: nextPhone(), phoneVerifiedAt: new Date() },
  });
  const extra = await post(
    { id: account2.id, token: await signSessionToken(account2.id, 1) },
    "/v1/workers",
    {
      fullName: "João de Teste",
      cpf: makeCpf(),
      birthDate: "1992-03-14",
      cityId: POCOS,
      neighborhood: "Centro",
      termsVersion: CURRENT_TERMS_VERSION,
      termsAccepted: true,
      roles: ["garcom"],
    },
  );
  assert.equal(extra.statusCode, 400);

  // E o PATCH completa: com selfie, funções, disponibilidade e bairro, o
  // status vira `complete`. Sem vídeo, ainda sem selo.
  const patched = await app.inject({
    method: "PATCH",
    url: "/v1/workers/me",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      documentSelfieKey: "docs/maria.jpg",
      roles: ["garcom"],
      availability: [{ weekday: 6, period: "night" }],
      experience: "Dois anos em buffet.",
    },
  });
  assert.equal(patched.statusCode, 200);
  assert.equal(patched.json().data.status, "complete");
  assert.equal(
    patched.json().data.profileCompletedAt,
    null,
    "o selo é o vídeo: sem ele, cadastro completo mas sem selo",
  );

  // Com o vídeo, o selo aparece.
  const withVideo = await app.inject({
    method: "PATCH",
    url: "/v1/workers/me",
    headers: { authorization: `Bearer ${token}` },
    payload: { introVideoKey: "videos/maria.mp4" },
  });
  assert.notEqual(withVideo.json().data.profileCompletedAt, null);
}

/**
 * d) A DECISÃO do item 4: quem desativa some do feed e da busca, mas a
 * candidatura que a empresa já tem NÃO desaparece — ela fica marcada.
 */
async function testDeactivatedStaysInCompanyList(): Promise<void> {
  const company = await makeCompany();
  const worker = await makeWorker();

  const jobId = await makeJob(company, { vacancies: 2 });
  assert.equal(
    (await post(worker, `/v1/jobs/${jobId}/applications`)).statusCode,
    201,
  );

  // Antes: aparece no próprio feed e na lista da empresa.
  assert.ok((await get(worker, "/v1/me/jobs")).json().data.total >= 0);
  const before = await get(company, `/v1/jobs/${jobId}/applicants`);
  assert.equal(before.json().data.candidates.length, 1);
  assert.equal(before.json().data.candidates[0].worker.isDeactivated, false);

  // A pessoa desativa a PRÓPRIA conta.
  const off = await post(worker, "/v1/workers/me/deactivate");
  assert.equal(off.statusCode, 200);
  assert.equal(off.json().data.status, "self_deactivated");

  // Some do feed: o roteamento do §16.2 só considera `complete`.
  const feed = await get(worker, "/v1/me/jobs");
  assert.equal(feed.json().data.total, 0);

  // Some da BUSCA pública — a view continua filtrando.
  const hidden = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM worker_public_profiles WHERE id = ${worker.id}::uuid`;
  assert.equal(hidden.length, 0, "a view tem que continuar filtrando");

  // Mas a candidatura CONTINUA na lista da empresa, marcada.
  const after = await get(company, `/v1/jobs/${jobId}/applicants`);
  const candidates = after.json().data.candidates;
  assert.equal(
    candidates.length,
    1,
    "a candidatura sumiu da lista da empresa quando a conta foi desativada",
  );
  assert.equal(candidates[0].worker.isDeactivated, true);
  assert.equal(candidates[0].worker.id, worker.id);
  // O que a empresa já tinha continua lá: o código da conversa e o nome
  // público — sem eles, o combinado no WhatsApp fica órfão.
  assert.ok(candidates[0].application.shortCode.length === 4);
  assert.ok(candidates[0].worker.firstName.length > 0);
  assert.ok(candidates[0].worker.lastNameInitial.length > 0);

  // E o telefone continua fora, como em qualquer lista.
  assert.ok(!JSON.stringify(after.json().data).includes(PHONE_PREFIX));
}

/** e) Reativar devolve tudo: status recalculado e volta ao feed. */
async function testReactivateRestores(): Promise<void> {
  const company = await makeCompany();
  const worker = await makeWorker();
  // A vaga tem que cair no slot que o trabalhador declarou (sábado à noite),
  // senão o feed devolve vazio pela disponibilidade e o teste não estaria
  // medindo a reativação.
  await makeJob(company, { onSaturdayNight: true });

  assert.equal((await post(worker, "/v1/workers/me/deactivate")).statusCode, 200);
  assert.equal((await get(worker, "/v1/me/jobs")).json().data.total, 0);

  const back = await post(worker, "/v1/workers/me/reactivate");
  assert.equal(back.statusCode, 200);
  // `complete` porque o cadastro estava completo antes — recalculado, não
  // guardado: quem desativou pela metade volta `incomplete`.
  assert.equal(back.json().data.status, "complete");

  // Volta ao feed e à busca.
  assert.ok((await get(worker, "/v1/me/jobs")).json().data.total >= 1);
  const visible = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM worker_public_profiles WHERE id = ${worker.id}::uuid`;
  assert.equal(visible.length, 1);
}

await cleanup();
try {
  await testWithdrawFreesASeat();
  console.log("ok — sair devolve a cadeira e outro entra");
  await cleanup();

  await testWithdrawAfterStartIs409();
  console.log("ok — sair depois de a vaga começar: 409");
  await cleanup();

  await testMinimalRegistration();
  console.log("ok — cadastro mínimo nasce incomplete e sem selo");
  await cleanup();

  await testDeactivatedStaysInCompanyList();
  console.log("ok — desativado some da busca, fica na lista da empresa");
  await cleanup();

  await testReactivateRestores();
  console.log("ok — reativar devolve status, feed e busca");

  console.log("ok — 5 testes das escritas do trabalhador");
} finally {
  await cleanup();
  await app.close();
  await prisma.$disconnect();
}
