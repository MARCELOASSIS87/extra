import assert from "node:assert/strict";

/**
 * As travas das quatro rotas do painel da empresa (tarefa 23b).
 *
 * Duas perguntas, e são as mesmas para as quatro: **o que prova que este
 * token pode ver este registro?** e **sai telefone daqui?**
 *
 * A primeira é a autorização — cada rota responde só com dado da empresa do
 * token, e a prova é uma empresa B pedindo e recebendo vazio ou 404, nunca o
 * registro da A. A segunda é a regra 8: nenhuma das quatro pode carregar
 * telefone, porque uma lista com dezoito números é uma lista telefônica que
 * basta abrir o DevTools para copiar — não importa que a tela não os desenhe.
 */
process.env.WHATSAPP_BUSINESS_NUMBER ??= "5535999999999";

const { prisma } = await import("./db.js");
const { buildServer } = await import("./server.js");
const { signSessionToken } = await import("./auth/token.js");

const PHONE_PREFIX = "+5535966";
const DOCUMENT_PREFIX = "6600000000";
const CPF_PREFIX = "660";
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
      document: `${DOCUMENT_PREFIX}${String(seq).padStart(4, "0")}`.slice(0, 14),
      legalName: `Empresa ${seq} LTDA`,
      tradeName: `Teste ${seq}`,
      responsibleName: "Fulano de Teste",
      email: `empresa${seq}@example.com`,
      cityId: POCOS,
      subscriptionStatus: "active",
    },
  });
  return { id: company.id, token: await signSessionToken(account.id, 1), phone };
}

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
      status: "complete",
      termsVersion: "v1",
      termsAcceptedAt: new Date(),
      termsAcceptedIp: "127.0.0.1",
      roles: { create: [{ role: "garcom" }] },
      notificationCities: { create: [{ cityId: POCOS }] },
      availability: { create: [{ weekday: 6, period: "night" }] },
    },
  });
  return { id: worker.id, token: await signSessionToken(account.id, 1), phone };
}

/** Vaga já terminada quando `past`, para cair na fila de presença. */
async function makeJob(company: Actor, past = false): Promise<string> {
  seq += 1;
  const startsAt = past
    ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const job = await prisma.jobPost.create({
    data: {
      companyId: company.id,
      cityId: POCOS,
      slug: `vaga-de-teste-23b-${seq}`,
      role: "garcom",
      title: "Garçom para teste",
      description: "Vaga criada pelo teste automático.",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 4 * 60 * 60 * 1000),
      payAmount: 150,
      address: "Rua de Teste, 1",
      neighborhood: "Centro",
      vacancies: 2,
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

const get = (actor: Actor, url: string) =>
  app.inject({
    method: "GET",
    url,
    headers: { authorization: `Bearer ${actor.token}` },
  });

/**
 * Toda chave que aparece no payload, em qualquer profundidade. Conferir o
 * TIPO não prova nada sobre o que sai no fio: o tipo é o que se acredita
 * estar devolvendo, as chaves são o que realmente vai.
 */
const keysOf = (value: unknown, found = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) value.forEach((item) => keysOf(item, found));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      found.add(key);
      keysOf(child, found);
    }
  }
  return found;
};

const SECRET_KEYS = ["phone", "workerPhone", "telefone", "cpf", "birthDate"];

function assertNoContactKeys(payload: unknown, what: string): void {
  const keys = keysOf(payload);
  for (const key of SECRET_KEYS) {
    assert.ok(!keys.has(key), `a chave "${key}" não pode existir em ${what}`);
  }
  // E o número em si, caso um dia ele viaje sob outro nome.
  const raw = JSON.stringify(payload);
  assert.ok(
    !raw.includes(PHONE_PREFIX),
    `um telefone apareceu no corpo de ${what}`,
  );
}

/** a) GET /v1/companies/me/jobs responde só com as vagas da empresa do token. */
async function testMyJobsIsScopedToCompany(): Promise<void> {
  const owner = await makeCompany();
  const other = await makeCompany();
  const jobId = await makeJob(owner);
  await makeJob(other);

  const mine = await get(owner, "/v1/companies/me/jobs");
  assert.equal(mine.statusCode, 200);
  const ids = mine.json().data.map((job: { id: string }) => job.id);
  assert.deepEqual(ids, [jobId]);

  // A empresa B não enxerga a vaga da A por esta rota.
  const theirs = await get(other, "/v1/companies/me/jobs");
  assert.ok(
    !theirs
      .json()
      .data.map((job: { id: string }) => job.id)
      .includes(jobId),
    "a vaga da empresa A apareceu no painel da empresa B",
  );

  assertNoContactKeys(mine.json().data, "GET /v1/companies/me/jobs");
}

/**
 * b) O painel mostra a vaga em QUALQUER estado — é o que o separa da listagem
 * pública, que só devolve aberta e não vencida.
 */
async function testMyJobsIncludesClosedAndExpired(): Promise<void> {
  const owner = await makeCompany();
  const openId = await makeJob(owner);
  const filledId = await makeJob(owner);
  await prisma.jobPost.update({
    where: { id: filledId },
    data: { status: "filled" },
  });

  const response = await get(owner, "/v1/companies/me/jobs");
  const ids = response.json().data.map((job: { id: string }) => job.id);
  assert.ok(ids.includes(openId) && ids.includes(filledId));
}

/** c) GET /v1/companies/me/applicants: só candidatura de vaga da empresa. */
async function testNewApplicantsIsScopedToCompany(): Promise<void> {
  const owner = await makeCompany();
  const other = await makeCompany();
  const worker = await makeWorker();

  const jobId = await makeJob(owner);
  const foreignJobId = await makeJob(other);
  assert.equal((await apply(worker, jobId)).statusCode, 201);
  assert.equal((await apply(worker, foreignJobId)).statusCode, 201);

  const mine = await get(owner, "/v1/companies/me/applicants");
  assert.equal(mine.statusCode, 200);
  const jobIds = mine
    .json()
    .data.map((item: { job: { id: string } }) => item.job.id);
  assert.deepEqual(jobIds, [jobId]);
  assert.ok(
    !jobIds.includes(foreignJobId),
    "candidatura de vaga de outra empresa apareceu na fila",
  );

  assertNoContactKeys(mine.json().data, "GET /v1/companies/me/applicants");
}

/** d) GET /v1/jobs/:id/applicants: vaga de outra empresa é 404, não 403. */
async function testCandidatesAreScopedAndComplete(): Promise<void> {
  const owner = await makeCompany();
  const other = await makeCompany();
  const worker = await makeWorker();
  const jobId = await makeJob(owner);
  assert.equal((await apply(worker, jobId)).statusCode, 201);

  const mine = await get(owner, `/v1/jobs/${jobId}/applicants`);
  assert.equal(mine.statusCode, 200);
  const body = mine.json().data;

  // A vaga vem junto, e o candidato traz o que a tela mostra.
  assert.equal(body.job.id, jobId);
  assert.equal(body.candidates.length, 1);
  const candidate = body.candidates[0];
  // Antes de chamar, o nome completo não sai (§16.5) — mas o primeiro nome e a
  // inicial saem, e é isso que a tela mostra. O portão tem teste próprio em (h).
  assert.equal(candidate.worker.fullName, null);
  assert.ok(candidate.worker.firstName.length > 0, "faltou o primeiro nome");
  assert.ok(Array.isArray(candidate.worker.availability));
  assert.equal(candidate.presentWithCompany, 0);
  assert.equal(candidate.attendanceStatus, null);

  // 404 e não 403: dizer "é de outra empresa" já confirma que o id existe.
  const theirs = await get(other, `/v1/jobs/${jobId}/applicants`);
  assert.equal(theirs.statusCode, 404);

  assertNoContactKeys(body, "GET /v1/jobs/:id/applicants");
}

/** e) A fila de presença: só vaga da empresa do token, e sem telefone. */
async function testPendingIsScopedToCompany(): Promise<void> {
  const owner = await makeCompany();
  const other = await makeCompany();
  const worker = await makeWorker();

  const jobId = await makeJob(owner, true);
  // Inserida direto: a rota recusa candidatura a vaga que já venceu, e com
  // razão — a fila de presença é justamente sobre trabalho que JÁ aconteceu.
  await prisma.application.create({
    data: { jobPostId: jobId, workerId: worker.id, shortCode: "AB12" },
  });

  const mine = await get(owner, "/v1/companies/me/attendance/pending");
  assert.equal(mine.statusCode, 200);
  const items = mine.json().data;
  assert.equal(items.length, 1);
  assert.equal(items[0].job.id, jobId);
  // O card é o mesmo das outras telas: vaga inteira e perfil de candidato.
  assert.equal(items[0].worker.fullName, null);
  assert.ok(items[0].worker.firstName.length > 0);
  assert.equal(items[0].job.address, "Rua de Teste, 1");

  const theirs = await get(other, "/v1/companies/me/attendance/pending");
  assert.deepEqual(theirs.json().data, []);

  assertNoContactKeys(items, "GET /v1/companies/me/attendance/pending");
}

/**
 * f) A contagem de alcance é a MESMA query que decide o push — o ponto
 * inteiro da rota. O trabalhador daqui assinou Poços, é garçom e declarou
 * sábado à noite; a vaga é de sábado à noite em Poços, então ele entra.
 */
async function testReachCountUsesRoutingRules(): Promise<void> {
  const company = await makeCompany();
  const worker = await makeWorker();

  // Um sábado às 22h em Poços, no futuro.
  const saturdayNight = new Date();
  saturdayNight.setUTCDate(
    saturdayNight.getUTCDate() + ((6 - saturdayNight.getUTCDay() + 7) % 7 || 7),
  );
  saturdayNight.setUTCHours(1, 0, 0, 0); // 22h de sábado em São Paulo (UTC-3)

  const query = new URLSearchParams({
    cityId: POCOS,
    role: "garcom",
    reach: "unrestricted",
    startsAt: saturdayNight.toISOString(),
  });
  const response = await get(company, `/v1/jobs/reach-count?${query}`);
  assert.equal(response.statusCode, 200);
  assert.ok(
    response.json().data.count >= 1,
    "quem assinou a cidade, tem a função e a disponibilidade não foi contado",
  );

  // A mesma pergunta para uma função que ninguém declarou: ninguém é avisado.
  const otherRole = new URLSearchParams({
    cityId: POCOS,
    role: "seguranca",
    reach: "unrestricted",
    startsAt: saturdayNight.toISOString(),
  });
  const empty = await get(company, `/v1/jobs/reach-count?${otherRole}`);
  assert.equal(empty.json().data.count, 0);

  assert.ok(worker.id.length > 0);
}

/**
 * h) O portão do nome completo (§16.5, regra 8): `fullName` é null nas TRÊS
 * telas antes de a empresa chamar, e o primeiro nome com a inicial continuam
 * vindo — nenhuma tela fica sem nome nenhum.
 */
async function testFullNameIsNullBeforeContact(): Promise<void> {
  const owner = await makeCompany();
  const worker = await makeWorker();

  const jobId = await makeJob(owner);
  assert.equal((await apply(worker, jobId)).statusCode, 201);

  // 1. lista de candidatos (é também o detalhe: a tela lê da mesma rota)
  const candidates = await get(owner, `/v1/jobs/${jobId}/applicants`);
  const candidate = candidates.json().data.candidates[0];
  assert.equal(
    candidate.worker.fullName,
    null,
    "o nome completo saiu antes de a empresa chamar",
  );
  assert.ok(
    candidate.worker.firstName.length > 0 &&
      candidate.worker.lastNameInitial.length > 0,
    "sem o nome completo a tela ainda precisa de primeiro nome e inicial",
  );

  // 2. fila de presença, com uma vaga que já aconteceu
  const pastJobId = await makeJob(owner, true);
  await prisma.application.create({
    data: { jobPostId: pastJobId, workerId: worker.id, shortCode: "CD34" },
  });
  const pending = await get(owner, "/v1/companies/me/attendance/pending");
  const item = pending.json().data[0];
  assert.equal(item.worker.fullName, null);
  assert.ok(item.worker.firstName.length > 0);

  assertNoContactKeys(candidates.json().data, "candidatos antes do contato");
  assertNoContactKeys(pending.json().data, "fila antes do contato");
}

/**
 * i) Depois de pedir o contato, o nome completo aparece — e SÓ naquela
 * candidatura. Chamar um candidato não abre o nome dos outros da mesma vaga.
 */
async function testFullNameOpensOnlyForContacted(): Promise<void> {
  const owner = await makeCompany();
  const chosen = await makeWorker();
  const other = await makeWorker();

  const jobId = await makeJob(owner);
  assert.equal((await apply(chosen, jobId)).statusCode, 201);
  assert.equal((await apply(other, jobId)).statusCode, 201);

  const before = await get(owner, `/v1/jobs/${jobId}/applicants`);
  const chosenApplication = before
    .json()
    .data.candidates.find(
      (item: { worker: { id: string } }) => item.worker.id === chosen.id,
    ).application.id;

  // O pedido de contato devolve telefone e nome completo de uma vez.
  const contact = await get(
    owner,
    `/v1/applications/${chosenApplication}/contact`,
  );
  assert.equal(contact.statusCode, 200);
  assert.ok(contact.json().data.phone.startsWith("+55"));
  assert.ok(
    contact.json().data.fullName.length > 0,
    "o contato tem que devolver o nome completo junto com o telefone",
  );

  const after = await get(owner, `/v1/jobs/${jobId}/applicants`);
  for (const item of after.json().data.candidates) {
    if (item.worker.id === chosen.id) {
      assert.equal(
        item.worker.fullName,
        contact.json().data.fullName,
        "depois de chamar, o nome completo tem que aparecer na lista",
      );
    } else {
      assert.equal(
        item.worker.fullName,
        null,
        "chamar um candidato abriu o nome de outro",
      );
    }
  }

  // E o telefone continua fora da lista: só a rota de contato o revela.
  assertNoContactKeys(after.json().data, "candidatos depois do contato");
}

/**
 * j) Uma empresa não herda o contato da outra: B chamou, A continua sem o
 * nome. O portão é por empresa, não por trabalhador.
 */
async function testContactDoesNotLeakAcrossCompanies(): Promise<void> {
  const a = await makeCompany();
  const b = await makeCompany();
  const worker = await makeWorker();

  const jobA = await makeJob(a);
  const jobB = await makeJob(b);
  assert.equal((await apply(worker, jobA)).statusCode, 201);
  assert.equal((await apply(worker, jobB)).statusCode, 201);

  const bList = await get(b, `/v1/jobs/${jobB}/applicants`);
  const bApplication = bList.json().data.candidates[0].application.id;
  assert.equal(
    (await get(b, `/v1/applications/${bApplication}/contact`)).statusCode,
    200,
  );

  const aList = await get(a, `/v1/jobs/${jobA}/applicants`);
  assert.equal(
    aList.json().data.candidates[0].worker.fullName,
    null,
    "a empresa A viu o nome completo porque a B chamou",
  );
}

/** g) Rota de empresa com token de trabalhador: 403 nas quatro. */
async function testWorkerTokenIsRejected(): Promise<void> {
  const worker = await makeWorker();
  for (const url of [
    "/v1/companies/me/jobs",
    "/v1/companies/me/applicants",
    "/v1/companies/me/attendance/pending",
  ]) {
    const response = await get(worker, url);
    assert.equal(response.statusCode, 403, `${url} devia recusar trabalhador`);
  }
}

await cleanup();
try {
  await testMyJobsIsScopedToCompany();
  console.log("ok — painel: só as vagas da empresa do token");
  await cleanup();

  await testMyJobsIncludesClosedAndExpired();
  console.log("ok — painel: vaga em qualquer estado, não só aberta");
  await cleanup();

  await testNewApplicantsIsScopedToCompany();
  console.log("ok — fila de candidatos novos: escopada à empresa");
  await cleanup();

  await testCandidatesAreScopedAndComplete();
  console.log("ok — candidatos da vaga: completos, e 404 para outra empresa");
  await cleanup();

  await testPendingIsScopedToCompany();
  console.log("ok — fila de presença: escopada, com vaga e perfil inteiros");
  await cleanup();

  await testReachCountUsesRoutingRules();
  console.log("ok — contagem de alcance pela query do roteamento (§16.2)");
  await cleanup();

  await testWorkerTokenIsRejected();
  console.log("ok — token de trabalhador não abre rota de empresa");
  await cleanup();

  await testFullNameIsNullBeforeContact();
  console.log("ok — nome completo null antes do contato, nas três telas");
  await cleanup();

  await testFullNameOpensOnlyForContacted();
  console.log("ok — contato abre o nome só daquela candidatura");
  await cleanup();

  await testContactDoesNotLeakAcrossCompanies();
  console.log("ok — contato de uma empresa não abre o nome para a outra");

  console.log("ok — 10 testes do painel da empresa");
} finally {
  await cleanup();
  await app.close();
  await prisma.$disconnect();
}
