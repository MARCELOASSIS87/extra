import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

/**
 * Testa contra o Postgres local, por `app.inject` — sem abrir porta. São os
 * cinco pontos em que uma falha de autenticação não aparece como erro: ela
 * aparece como login de outra pessoa.
 *
 * As credenciais do WhatsApp entram antes do import de `env.ts`, que lê
 * `process.env` na carga. Por isso os imports abaixo são dinâmicos.
 */
process.env.WHATSAPP_APP_SECRET ??= "segredo-de-teste-do-app-meta";
process.env.WHATSAPP_BUSINESS_NUMBER ??= "5535999999999";
process.env.WHATSAPP_VERIFY_TOKEN ??= "token-de-teste";

const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

const { prisma } = await import("./db.js");
const { buildServer } = await import("./server.js");
const { hashAttemptId, hashCode, randomAttemptId, signSessionToken } =
  await import("./auth/token.js");
const { MAX_CODES_PER_PHONE_PER_HOUR } =
  await import("@extra/shared/constants/auth");

// Prefixo próprio para que a limpeza não encoste em dado de verdade.
const PREFIX = "+5535911";
const phone = (suffix: string): string => `${PREFIX}${suffix}`;

const app = buildServer();
await app.ready();

async function cleanup(): Promise<void> {
  await prisma.phoneVerificationCode.deleteMany({
    where: { phone: { startsWith: PREFIX } },
  });
  await prisma.account.deleteMany({ where: { phone: { startsWith: PREFIX } } });
  await prisma.whatsappEvent.deleteMany({
    where: { messageId: { startsWith: "wamid.test" } },
  });
}

const webhookBody = (from: string, code: string, messageId: string): string =>
  JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  id: messageId,
                  from,
                  text: { body: `Confirmar meu numero: ${code}` },
                },
              ],
            },
          },
        ],
      },
    ],
  });

const sign = (raw: string, secret: string): string =>
  `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;

const postWebhook = (raw: string, signature: string) =>
  app.inject({
    method: "POST",
    url: "/v1/webhooks/whatsapp",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": signature,
    },
    payload: raw,
  });

/** Uma tentativa pronta no banco, como se `request-code` tivesse rodado. */
async function seedAttempt(
  target: string,
  code: string,
  overrides: {
    expiresAt?: Date;
    consumedAt?: Date | null;
    verifiedAt?: Date | null;
  } = {},
): Promise<string> {
  const attemptId = randomAttemptId();
  await prisma.phoneVerificationCode.create({
    data: {
      phone: target,
      codeHash: hashCode(target, code),
      attemptIdHash: hashAttemptId(attemptId),
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: overrides.consumedAt ?? null,
      verifiedAt: overrides.verifiedAt ?? null,
    },
  });
  return attemptId;
}

// --- a) assinatura forjada não autentica ninguém ----------------------------
// É a falha mais grave possível: webhook aceito sem assinatura válida é login
// como qualquer pessoa da base. O controle positivo no fim existe para que o
// teste não passe por a rota estar quebrada de outro jeito.
async function testForgedSignature(): Promise<void> {
  const target = phone("00001");
  const code = "123456";
  await seedAttempt(target, code);
  await prisma.account.create({ data: { phone: target } });

  // O remetente sai do próprio telefone semeado: a Meta manda sem o "+",
  // e um número escrito à mão aqui vira teste que passa pelo motivo errado.
  const raw = webhookBody(target.slice(1), code, "wamid.test.forged");
  const forged = await postWebhook(raw, sign(raw, "segredo-errado"));

  assert.equal(forged.statusCode, 401, "assinatura forjada precisa dar 401");

  const untouched = await prisma.account.findUniqueOrThrow({
    where: { phone: target },
  });
  assert.equal(
    untouched.phoneVerifiedAt,
    null,
    "assinatura forjada não pode gravar phoneVerifiedAt",
  );
  assert.equal(
    await prisma.whatsappEvent.count({
      where: { messageId: "wamid.test.forged" },
    }),
    0,
    "assinatura forjada não pode nem registrar o evento",
  );

  // Controle positivo: o mesmo corpo, assinado direito, confirma.
  const accepted = await postWebhook(raw, sign(raw, APP_SECRET));
  assert.equal(accepted.statusCode, 200);

  const verified = await prisma.account.findUniqueOrThrow({
    where: { phone: target },
  });
  assert.notEqual(
    verified.phoneVerifiedAt,
    null,
    "assinatura válida precisa gravar phoneVerifiedAt",
  );
}

// --- b) tentativa inexistente, expirada e consumida são indistinguíveis -----
// Três respostas diferentes contariam a um estranho em que pé está o login de
// outra pessoa.
async function testOpaqueAttempts(): Promise<void> {
  const target = phone("00002");

  const missing = randomAttemptId();
  const expired = await seedAttempt(target, "222222", {
    expiresAt: new Date(Date.now() - 1000),
    verifiedAt: new Date(),
  });
  const consumed = await seedAttempt(target, "333333", {
    verifiedAt: new Date(),
    consumedAt: new Date(),
  });

  const responses = await Promise.all(
    [missing, expired, consumed].map((attemptId) =>
      app.inject({ method: "GET", url: `/v1/auth/attempts/${attemptId}` }),
    ),
  );

  const [first, ...rest] = responses;
  for (const response of rest) {
    assert.equal(response.statusCode, first.statusCode);
    assert.equal(response.body, first.body);
  }
  assert.equal(first.statusCode, 404);
  assert.equal(JSON.parse(first.body).ok, false);
}

// --- c) quarta tentativa de código na mesma hora ----------------------------
async function testPhoneRateLimit(): Promise<void> {
  const target = phone("00003");

  for (let attempt = 0; attempt < MAX_CODES_PER_PHONE_PER_HOUR; attempt++) {
    const allowed = await app.inject({
      method: "POST",
      url: "/v1/auth/request-code",
      payload: { phone: target },
    });
    assert.equal(allowed.statusCode, 200, `tentativa ${attempt + 1}`);
  }

  const blocked = await app.inject({
    method: "POST",
    url: "/v1/auth/request-code",
    payload: { phone: target },
  });

  assert.equal(blocked.statusCode, 429);
  assert.equal(JSON.parse(blocked.body).error.code, "too_many_requests");
}

// --- d) token com versão de sessão velha ------------------------------------
// Sem isto não existe resposta a incidente: um token vazado valeria 30 dias.
async function testStaleSessionVersion(): Promise<void> {
  const account = await prisma.account.create({
    data: { phone: phone("00004"), phoneVerifiedAt: new Date() },
  });

  const token = await signSessionToken(account.id, account.sessionVersion);

  const before = await app.inject({
    method: "GET",
    url: "/v1/auth/me",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(before.statusCode, 200, "token na versão certa precisa entrar");

  await prisma.account.update({
    where: { id: account.id },
    data: { sessionVersion: { increment: 1 } },
  });

  const after = await app.inject({
    method: "GET",
    url: "/v1/auth/me",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(after.statusCode, 401);
  assert.equal(JSON.parse(after.body).error.code, "unauthorized");
}

// --- e) cadastrado e não cadastrado respondem igual -------------------------
// Qualquer diferença aqui transforma a rota num verificador de quem tem conta.
async function testUniformRequestCode(): Promise<void> {
  const known = phone("00005");
  const unknown = phone("00006");
  await prisma.account.create({
    data: { phone: known, phoneVerifiedAt: new Date() },
  });

  const [first, second] = await Promise.all(
    [known, unknown].map((target) =>
      app.inject({
        method: "POST",
        url: "/v1/auth/request-code",
        payload: { phone: target },
      }),
    ),
  );

  assert.equal(first.statusCode, second.statusCode);
  assert.equal(first.statusCode, 200);

  const shape = (body: string): string =>
    JSON.stringify(Object.keys(JSON.parse(body).data).sort());
  assert.equal(shape(first.body), shape(second.body));

  // E o corpo não pode carregar nada além do combinado (§11.1).
  assert.deepEqual(Object.keys(JSON.parse(first.body).data).sort(), [
    "attemptId",
    "expiresAt",
    "waLink",
  ]);
}

await cleanup();
try {
  await testForgedSignature();
  await testOpaqueAttempts();
  await testPhoneRateLimit();
  await testStaleSessionVersion();
  await testUniformRequestCode();
  console.log("auth.test.ts: os cinco testes passaram");
} finally {
  await cleanup();
  await app.close();
  await prisma.$disconnect();
}
