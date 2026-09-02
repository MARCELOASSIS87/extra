import assert from "node:assert/strict";
import { Writable } from "node:stream";

/**
 * As seis travas de empresa, denúncia e inscrição de push.
 *
 * Duas delas guardam segredo alheio: o documento duplicado, que não pode
 * virar verificador de quem está na plataforma, e as chaves de push, que são
 * credencial de envio e não podem aparecer em log nenhum.
 */
process.env.WHATSAPP_BUSINESS_NUMBER ??= "5535999999999";

const { prisma } = await import("./db.js");
const { buildServer } = await import("./server.js");
const { signSessionToken } = await import("./auth/token.js");
const { CURRENT_TERMS_VERSION } = await import("@extra/shared/constants/terms");

const PHONE_PREFIX = "+5535977";
const CNPJ_PREFIX = "55";
const CPF_PREFIX = "550";
const POCOS = "3151800";

/** Tudo que o app escreveu em log, para o teste (f) poder varrer. */
let logged = "";
const logSink = new Writable({
  write(chunk, _encoding, done) {
    logged += String(chunk);
    done();
  },
});

const app = buildServer(logSink);
await app.ready();

async function cleanup(): Promise<void> {
  await prisma.report.deleteMany({
    where: { details: { startsWith: "[teste-22f]" } },
  });
  await prisma.company.deleteMany({
    where: { document: { startsWith: CNPJ_PREFIX } },
  });
  await prisma.worker.deleteMany({
    where: { cpf: { startsWith: CPF_PREFIX } },
  });
  await prisma.account.deleteMany({
    where: { phone: { startsWith: PHONE_PREFIX } },
  });
}

let seq = 0;

async function makeAccount(): Promise<{ id: string; token: string }> {
  seq += 1;
  const account = await prisma.account.create({
    data: {
      phone: `${PHONE_PREFIX}${String(seq).padStart(5, "0")}`,
      phoneVerifiedAt: new Date(),
    },
  });
  return { id: account.id, token: await signSessionToken(account.id, 1) };
}

async function makeWorker(): Promise<{ token: string }> {
  const account = await makeAccount();
  seq += 1;
  await prisma.worker.create({
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
    },
  });
  return { token: await signSessionToken(account.id, 1) };
}

/** CNPJ com dígitos verificadores válidos, para bater na trava certa. */
function makeCnpj(): string {
  const base = `${CNPJ_PREFIX}${String(++seq).padStart(10, "0")}`;
  const digit = (partial: string, weights: number[]): number => {
    const sum = partial
      .split("")
      .reduce((acc, char, index) => acc + Number(char) * weights[index], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = digit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digit(
    `${base}${first}`,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return `${base}${first}${second}`;
}

const validBody = (overrides: Record<string, unknown> = {}) => ({
  cnpj: makeCnpj(),
  legalName: "Buffet de Teste LTDA",
  tradeName: "Buffet Teste",
  responsibleName: "Fulano de Teste",
  phone: "+5535991230000",
  email: "contato@example.com",
  cityId: POCOS,
  termsAccepted: true,
  ...overrides,
});

const createCompany = (token: string, body: unknown) =>
  app.inject({
    method: "POST",
    url: "/v1/companies",
    headers: { authorization: `Bearer ${token}` },
    payload: body as Record<string, unknown>,
  });

const companyCount = () =>
  prisma.company.count({ where: { document: { startsWith: CNPJ_PREFIX } } });

/** a) CNPJ com dígito verificador inválido: 400. */
async function testInvalidCnpj(): Promise<void> {
  const account = await makeAccount();
  const response = await createCompany(
    account.token,
    validBody({ cnpj: "11222333000100" }),
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "validation_error");
  assert.equal(response.json().error.field, "cnpj");
  assert.equal(await companyCount(), 0);
}

/**
 * b) Documento já cadastrado: erro genérico, INDISTINGUÍVEL de um livre.
 * Confirmar transformaria a rota num verificador de quem contrata aqui.
 */
async function testDuplicateDocumentIsOpaque(): Promise<void> {
  const first = await makeAccount();
  const cnpj = makeCnpj();
  assert.equal(
    (await createCompany(first.token, validBody({ cnpj }))).statusCode,
    201,
  );

  const second = await makeAccount();
  const duplicate = await createCompany(second.token, validBody({ cnpj }));

  // Um documento livre, na mesma rota e com tudo mais igual, para comparar.
  const third = await makeAccount();
  const fresh = await createCompany(third.token, validBody());
  assert.equal(fresh.statusCode, 201);

  assert.equal(duplicate.statusCode, 400);
  assert.equal(duplicate.json().error.code, "registration_failed");
  assert.doesNotMatch(duplicate.body, /cnpj|documento/i);
  assert.doesNotMatch(duplicate.body, new RegExp(cnpj));
  assert.doesNotMatch(duplicate.body, /cadastrad|existe|duplicad|já tem/i);
  assert.equal(duplicate.json().error.field, undefined);

  assert.equal(
    await prisma.company.count({ where: { accountId: second.id } }),
    0,
  );
}

/** c) Segunda empresa na mesma conta: 409. */
async function testOneCompanyPerAccount(): Promise<void> {
  const account = await makeAccount();
  assert.equal(
    (await createCompany(account.token, validBody())).statusCode,
    201,
  );

  const second = await createCompany(account.token, validBody());

  assert.equal(second.statusCode, 409);
  assert.equal(second.json().error.code, "company_already_exists");
  assert.equal(
    await prisma.company.count({ where: { accountId: account.id } }),
    1,
  );
}

/** d) Denúncia com dois alvos: 400. Com zero: 400. Exatamente um. */
async function testReportTargetCount(): Promise<void> {
  const account = await makeAccount();
  const company = await prisma.company.create({
    data: {
      accountId: account.id,
      document: makeCnpj(),
      legalName: "Alvo LTDA",
      tradeName: "Alvo",
      responsibleName: "Fulano",
      email: "alvo@example.com",
      cityId: POCOS,
    },
  });
  seq += 1;
  const job = await prisma.jobPost.create({
    data: {
      companyId: company.id,
      cityId: POCOS,
      slug: `vaga-teste-22f-${seq}`,
      role: "garcom",
      title: "Garçom para teste",
      description: "Vaga do teste automático.",
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 90000000),
      payAmount: 150,
      address: "Rua de Teste, 1",
      neighborhood: "Centro",
      vacancies: 1,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const worker = await makeWorker();
  const workerRow = await prisma.worker.findFirstOrThrow({
    where: { cpf: { startsWith: CPF_PREFIX } },
    select: { id: true },
  });

  const report = (body: unknown) =>
    app.inject({ method: "POST", url: "/v1/reports", payload: body as object });

  const both = await report({
    targetJobPostId: job.id,
    targetWorkerId: workerRow.id,
    reason: "fake_job",
    details: "[teste-22f] dois alvos",
  });
  assert.equal(both.statusCode, 400, "dois alvos tem que ser 400");
  assert.equal(both.json().error.code, "validation_error");

  const neither = await report({
    reason: "fake_job",
    details: "[teste-22f] nenhum alvo",
  });
  assert.equal(neither.statusCode, 400, "zero alvo tem que ser 400");

  // Nenhum dos dois pode ter chegado ao banco — o 400 vem ANTES do CHECK.
  assert.equal(
    await prisma.report.count({
      where: { details: { startsWith: "[teste-22f]" } },
    }),
    0,
  );

  // E um alvo só passa, anônimo, para o 400 acima ser sobre a contagem.
  const ok = await report({
    targetJobPostId: job.id,
    reason: "fake_job",
    details: "[teste-22f] alvo único",
  });
  assert.equal(ok.statusCode, 201);
  const stored = await prisma.report.findUniqueOrThrow({
    where: { id: ok.json().data.id },
  });
  assert.equal(stored.reporterAccountId, null, "denúncia anônima é permitida");
  assert.equal(stored.targetWorkerId, null);
  void worker;
}

/** e) Mesmo endpoint de push duas vezes: uma linha só. */
async function testPushSubscribeIsIdempotent(): Promise<void> {
  const worker = await makeWorker();
  const endpoint = "https://fcm.googleapis.com/fcm/send/teste-22f-endpoint";

  const subscribe = (auth: string) =>
    app.inject({
      method: "POST",
      url: "/v1/push/subscribe",
      headers: { authorization: `Bearer ${worker.token}` },
      payload: {
        endpoint,
        keys: { p256dh: "chave-publica-de-teste", auth },
      },
    });

  const first = await subscribe("segredo-um");
  const second = await subscribe("segredo-dois");

  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 201);
  assert.equal(first.json().data.id, second.json().data.id, "mesma linha");

  const rows = await prisma.pushSubscription.findMany({ where: { endpoint } });
  assert.equal(rows.length, 1, "reinscrever não pode duplicar");
  // E a reinscrição renovou as chaves em vez de manter as velhas.
  assert.equal(
    (rows[0].subscription as { keys: { auth: string } }).keys.auth,
    "segredo-dois",
  );
}

/**
 * f) O corpo do push NÃO aparece no log. As `keys` são credencial de envio:
 * quem as tem notifica aquele aparelho. Varre o log inteiro, inclusive o do
 * caminho de erro — é ali que o input costuma vazar junto do `err`.
 */
async function testPushBodyNeverLogged(): Promise<void> {
  const worker = await makeWorker();
  const secret = "segredo-que-nao-pode-vazar-22f";
  const endpoint = "https://fcm.googleapis.com/fcm/send/teste-22f-log";

  logged = "";

  await app.inject({
    method: "POST",
    url: "/v1/push/subscribe",
    headers: { authorization: `Bearer ${worker.token}` },
    payload: { endpoint, keys: { p256dh: "chave-publica", auth: secret } },
  });

  // O caminho de ERRO também: um corpo inválido é onde o input costuma ir
  // parar no log, junto do objeto de erro.
  await app.inject({
    method: "POST",
    url: "/v1/push/subscribe",
    headers: { authorization: `Bearer ${worker.token}` },
    payload: { endpoint: "nao-e-url", keys: { p256dh: "x", auth: secret } },
  });

  assert.ok(logged.length > 0, "o teste precisa ter capturado algum log");
  assert.ok(
    !logged.includes(secret),
    "a chave de autenticação do push não pode aparecer no log",
  );
  assert.ok(
    !logged.includes(endpoint),
    "o endpoint da inscrição não pode aparecer no log",
  );
}

const tests: Array<[string, () => Promise<void>]> = [
  ["CNPJ com dígito inválido: 400", testInvalidCnpj],
  ["documento duplicado: erro genérico", testDuplicateDocumentIsOpaque],
  ["uma conta, uma empresa: 409", testOneCompanyPerAccount],
  ["denúncia precisa de exatamente um alvo", testReportTargetCount],
  ["mesmo endpoint de push: uma linha só", testPushSubscribeIsIdempotent],
  ["corpo do push nunca vai para o log", testPushBodyNeverLogged],
];

try {
  for (const [name, run] of tests) {
    await cleanup();
    await run();
    console.log(`ok — ${name}`);
  }
  console.log(`\nok — ${tests.length} testes de empresa, denúncia e push`);
} finally {
  await cleanup();
  await app.close();
  await prisma.$disconnect();
}
