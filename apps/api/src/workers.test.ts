import assert from "node:assert/strict";

/**
 * As seis travas do cadastro do trabalhador (§7.3, §16.1, §16.2).
 *
 * Quatro delas são tetos que existem para proteger a permissão de notificar e
 * o bloqueio de menores; a quinta é a que impede a rota de virar um oráculo de
 * CPF alheio.
 */
process.env.WHATSAPP_BUSINESS_NUMBER ??= "5535999999999";

const { prisma } = await import("./db.js");
const { buildServer } = await import("./server.js");
const { signSessionToken } = await import("./auth/token.js");
const { CURRENT_TERMS_VERSION } = await import("@extra/shared/constants/terms");

const PHONE_PREFIX = "+5535966";
const CPF_PREFIX = "660";
const POCOS = "3151800";
const ANDRADAS = "3102605";

const app = buildServer();
await app.ready();

async function cleanup(): Promise<void> {
  await prisma.worker.deleteMany({
    where: { cpf: { startsWith: CPF_PREFIX } },
  });
  await prisma.account.deleteMany({
    where: { phone: { startsWith: PHONE_PREFIX } },
  });
}

let seq = 0;

/** Uma conta autenticada, ainda SEM perfil de trabalhador. */
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

/** CPF com dígitos verificadores válidos, para o teste bater na trava certa. */
function makeCpf(): string {
  // 9 dígitos de base + 2 verificadores = 11. O prefixo já tem 3.
  const base = `${CPF_PREFIX}${String(++seq).padStart(6, "0")}`;
  const digit = (partial: string, start: number): number => {
    let total = 0;
    let factor = start;
    for (const char of partial) total += Number(char) * factor--;
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const first = digit(base, 10);
  const second = digit(`${base}${first}`, 11);
  return `${base}${first}${second}`;
}

/**
 * O corpo MÍNIMO da criação (§16.1): quem é a pessoa, onde mora e o aceite.
 * Funções, disponibilidade, cidades de aviso e raio não entram mais aqui —
 * chegam por PATCH, e os testes dos limites deles foram junto.
 */
const validBody = (overrides: Record<string, unknown> = {}) => ({
  fullName: "Ana Paula Ferreira",
  cpf: makeCpf(),
  birthDate: "1995-04-12",
  cityId: POCOS,
  neighborhood: "Centro",
  termsVersion: CURRENT_TERMS_VERSION,
  termsAccepted: true,
  ...overrides,
});

const create = (token: string, body: unknown) =>
  app.inject({
    method: "POST",
    url: "/v1/workers",
    headers: { authorization: `Bearer ${token}` },
    payload: body as Record<string, unknown>,
  });

/** Cria o cadastro mínimo e devolve o token, para os testes que editam. */
async function createdWorker(): Promise<string> {
  const account = await makeAccount();
  const response = await create(account.token, validBody());
  assert.equal(response.statusCode, 201);
  return account.token;
}

const patch = (token: string, url: string, body: unknown) =>
  app.inject({
    method: "PATCH",
    url,
    headers: { authorization: `Bearer ${token}` },
    payload: body as Record<string, unknown>,
  });

const workerCount = () =>
  prisma.worker.count({ where: { cpf: { startsWith: CPF_PREFIX } } });

/** a) Menor de 18: 400 e NADA persistido (ECA Digital, §14.2). */
async function testMinorIsRejected(): Promise<void> {
  const account = await makeAccount();
  const birthDate = new Date();
  birthDate.setUTCFullYear(birthDate.getUTCFullYear() - 17);

  const response = await create(
    account.token,
    validBody({ birthDate: birthDate.toISOString().slice(0, 10) }),
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "validation_error");
  assert.match(response.json().error.message, /18 anos/);
  assert.equal(await workerCount(), 0, "menor não pode ter sido gravado");
  assert.equal(
    await prisma.worker.count({ where: { accountId: account.id } }),
    0,
  );
}

/**
 * b) Seis funções: 400. O teto de 5 é do §7.3, e continua valendo — mudou a
 * PORTA: as funções chegam por PATCH, porque a criação virou o mínimo.
 */
async function testSixRolesRejected(): Promise<void> {
  const token = await createdWorker();
  const response = await patch(token, "/v1/workers/me", {
    roles: [
      "garcom",
      "barman",
      "cozinheiro",
      "auxiliar_cozinha",
      "auxiliar_limpeza",
      "recepcionista",
    ],
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.field, "roles");
  assert.equal(
    await prisma.workerRole.count({
      where: { worker: { cpf: { startsWith: CPF_PREFIX } } },
    }),
    0,
    "nenhuma função pode ter sido gravada",
  );
}

/**
 * c) Seis cidades de aviso: 400. E zero também: zero cidade significa zero
 * notificação, que a pessoa lê como "o site não funciona" — e ela não
 * reclama, some.
 */
async function testNotificationCityBounds(): Promise<void> {
  const tooMany = await createdWorker();
  const six = await patch(tooMany, "/v1/workers/me/notifications", {
    notificationCityIds: [
      POCOS,
      ANDRADAS,
      "3105301",
      "3110301",
      "3549102",
      "3153905",
    ],
    nearbyRadiusKm: null,
  });
  assert.equal(six.statusCode, 400);
  assert.equal(six.json().error.field, "notificationCityIds");

  const none = await createdWorker();
  const zero = await patch(none, "/v1/workers/me/notifications", {
    notificationCityIds: [],
    nearbyRadiusKm: null,
  });
  assert.equal(zero.statusCode, 400);
  assert.equal(zero.json().error.field, "notificationCityIds");

  assert.equal(
    await prisma.workerNotificationCity.count({
      where: { worker: { cpf: { startsWith: CPF_PREFIX } } },
    }),
    0,
    "nenhuma cidade de aviso pode ter sido gravada",
  );
}

/** d) Raio 100: 400. Valores fechados em 25 ou 50, nunca campo livre. */
async function testRadiusIsClosedSet(): Promise<void> {
  const token = await createdWorker();
  const response = await patch(token, "/v1/workers/me/notifications", {
    notificationCityIds: [POCOS],
    nearbyRadiusKm: 100,
  });

  assert.equal(response.statusCode, 400);
  const saved = await prisma.worker.findFirstOrThrow({
    where: { cpf: { startsWith: CPF_PREFIX } },
    select: { nearbyRadiusKm: true },
  });
  assert.equal(saved.nearbyRadiusKm, null, "o raio inválido não pode gravar");
}

/**
 * e) CPF já cadastrado: erro GENÉRICO. A resposta não pode permitir deduzir
 * que aquele CPF existe — senão a rota vira um verificador de quem está na
 * plataforma, aberto a quem tiver uma lista de CPFs.
 */
async function testDuplicateCpfIsOpaque(): Promise<void> {
  const first = await makeAccount();
  const cpf = makeCpf();

  const created = await create(first.token, validBody({ cpf }));
  assert.equal(created.statusCode, 201);

  const second = await makeAccount();
  const duplicate = await create(second.token, validBody({ cpf }));

  // Um CPF livre, na mesma rota e com tudo mais igual, para comparar.
  const third = await makeAccount();
  const fresh = await create(third.token, validBody({ cpf: makeCpf() }));
  assert.equal(fresh.statusCode, 201);

  assert.equal(duplicate.statusCode, 400);
  const body = duplicate.json();
  assert.equal(body.error.code, "registration_failed");

  // Nada na resposta pode nomear o CPF, o campo ou o conflito.
  assert.doesNotMatch(duplicate.body, /cpf/i, "a resposta não pode citar CPF");
  assert.doesNotMatch(duplicate.body, new RegExp(cpf));
  assert.doesNotMatch(
    duplicate.body,
    /cadastrad|existe|duplicad|já tem/i,
    "a mensagem não pode confirmar que o CPF existe",
  );
  assert.equal(body.error.field, undefined, "apontar o campo já entrega");

  assert.equal(
    await prisma.worker.count({ where: { accountId: second.id } }),
    0,
  );
}

/** f) Conta que já tem worker tentando criar outro: 409. */
async function testOneWorkerPerAccount(): Promise<void> {
  const account = await makeAccount();

  const first = await create(account.token, validBody());
  assert.equal(first.statusCode, 201);

  const second = await create(account.token, validBody());

  assert.equal(second.statusCode, 409);
  assert.equal(second.json().error.code, "worker_already_exists");
  assert.equal(
    await prisma.worker.count({ where: { accountId: account.id } }),
    1,
  );
}

const tests: Array<[string, () => Promise<void>]> = [
  ["menor de 18: 400 e nada persistido", testMinorIsRejected],
  ["seis funções: 400", testSixRolesRejected],
  ["cidades de aviso fora de 1..5: 400", testNotificationCityBounds],
  ["raio 100: 400", testRadiusIsClosedSet],
  ["CPF duplicado: erro genérico", testDuplicateCpfIsOpaque],
  ["uma conta, um trabalhador: 409", testOneWorkerPerAccount],
];

try {
  for (const [name, run] of tests) {
    await cleanup();
    await run();
    console.log(`ok — ${name}`);
  }
  console.log(`\nok — ${tests.length} testes de cadastro do trabalhador`);
} finally {
  await cleanup();
  await app.close();
  await prisma.$disconnect();
}
