import assert from "node:assert/strict";

/**
 * As cinco travas de publicar e fechar vaga (§8, §14.1 e a seção Segurança do
 * CLAUDE.md). Roda contra o Postgres local por `app.inject`, sem abrir porta.
 *
 * Cada uma guarda uma falha que não aparece como erro: um anúncio
 * discriminatório publicado, uma empresa suspensa publicando de graça, uma
 * empresa fechando a vaga de outra, e slug colidindo dentro da cidade ou
 * sendo inventado diferente entre cidades.
 */
process.env.WHATSAPP_BUSINESS_NUMBER ??= "5535999999999";

const { prisma } = await import("./db.js");
const { buildServer } = await import("./server.js");
const { signSessionToken } = await import("./auth/token.js");

const PHONE_PREFIX = "+5535933";
const DOCUMENT_PREFIX = "9900000000";
const SLUG_PREFIX = "garcom-para-formatura-de-teste";
const POCOS = "3151800"; // Poços de Caldas — MG
const ANDRADAS = "3102605"; // Andradas — MG

const day = 24 * 60 * 60 * 1000;

const app = buildServer();
await app.ready();

async function cleanup(): Promise<void> {
  await prisma.company.deleteMany({
    where: { document: { startsWith: DOCUMENT_PREFIX } },
  });
  await prisma.account.deleteMany({
    where: { phone: { startsWith: PHONE_PREFIX } },
  });
}

interface Actor {
  companyId: string;
  token: string;
}

let seq = 0;

/** Uma empresa com token pronto. `blocked_job_attempts` e vagas caem no
 * CASCADE da empresa quando a limpeza roda. */
async function makeCompany(
  cityId: string,
  subscriptionStatus: "active" | "suspended" = "active",
): Promise<Actor> {
  seq += 1;
  const account = await prisma.account.create({
    data: {
      phone: `${PHONE_PREFIX}${String(seq).padStart(5, "0")}`,
      phoneVerifiedAt: new Date(),
    },
  });
  const company = await prisma.company.create({
    data: {
      accountId: account.id,
      document: `${DOCUMENT_PREFIX}${String(seq).padStart(4, "0")}`.slice(
        0,
        14,
      ),
      legalName: `Empresa de Teste ${seq} LTDA`,
      tradeName: `Teste ${seq}`,
      responsibleName: "Fulano de Teste",
      email: `teste${seq}@example.com`,
      cityId,
      subscriptionStatus,
    },
  });
  return {
    companyId: company.id,
    token: await signSessionToken(account.id, 1),
  };
}

const validBody = (title: string, cityId: string = POCOS) => ({
  cityId,
  role: "garcom" as const,
  title,
  description: "Atendimento de mesas em formatura, com bandeja.",
  date: "2026-12-12",
  startTime: "22:00",
  // Vira a noite de propósito: é caso normal, não erro.
  endTime: "02:00",
  payAmount: 150,
  payNote: null,
  address: "Rua de Teste, 1",
  neighborhood: "Centro",
  requirements: null,
  vacancies: 2,
  providesTransport: false,
  reach: "unrestricted" as const,
  reachRadiusKm: null,
});

const post = (actor: Actor, body: unknown) =>
  app.inject({
    method: "POST",
    url: "/v1/jobs",
    headers: { authorization: `Bearer ${actor.token}` },
    payload: body as Record<string, unknown>,
  });

/**
 * a) Linguagem discriminatória: 400 com a mensagem do §14.1, e a tentativa
 * registrada com os termos que casaram. O registro é o ponto — sem ele a
 * plataforma barra e não tem como provar que barra.
 */
async function testDiscriminatoryIsBlockedAndLogged(): Promise<void> {
  const actor = await makeCompany(POCOS);

  const response = await post(
    actor,
    validBody("Moça de boa aparência para formatura"),
  );

  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "discriminatory_language");
  assert.match(body.error.message, /art\. 373-A/);
  // Explica, nunca acusa: a empresa precisa reescrever, não se defender.
  assert.doesNotMatch(body.error.message, /você|voce|discrimin(ou|ando)/i);

  const attempts = await prisma.blockedJobAttempt.findMany({
    where: { companyId: actor.companyId },
  });
  assert.equal(attempts.length, 1);
  assert.deepEqual(attempts[0].matchedTerms.sort(), ["boa aparência", "moça"]);
  assert.ok(attempts[0].requestIp, "a tentativa precisa guardar o IP");

  const created = await prisma.jobPost.count({
    where: { companyId: actor.companyId },
  });
  assert.equal(created, 0, "vaga bloqueada não pode ter sido publicada");
}

/** b) Assinatura suspensa não publica. */
async function testSuspendedCannotPublish(): Promise<void> {
  const suspended = await makeCompany(POCOS, "suspended");
  const response = await post(suspended, validBody(`${SLUG_PREFIX} suspensa`));

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "subscription_inactive");
  assert.equal(
    await prisma.jobPost.count({ where: { companyId: suspended.companyId } }),
    0,
  );
}

/**
 * c) Fechar vaga de outra empresa: 404, e nada muda. 404 e não 403 porque
 * 403 confirmaria a existência do id para quem só chutou.
 */
async function testCloseForeignJobIs404(): Promise<void> {
  const owner = await makeCompany(POCOS);
  const stranger = await makeCompany(ANDRADAS);

  const published = await post(owner, validBody(`${SLUG_PREFIX} alheia`));
  assert.equal(published.statusCode, 201);
  const jobId = published.json().data.id;

  const response = await app.inject({
    method: "PATCH",
    url: `/v1/jobs/${jobId}/close`,
    headers: { authorization: `Bearer ${stranger.token}` },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "not_found");

  const after = await prisma.jobPost.findUniqueOrThrow({
    where: { id: jobId },
    select: { status: true },
  });
  assert.equal(after.status, "open", "a vaga não pode ter sido alterada");
}

/** d) Dois títulos iguais na MESMA cidade: slugs diferentes. */
async function testSameTitleSameCityGetsDistinctSlugs(): Promise<void> {
  const actor = await makeCompany(POCOS);
  const title = `${SLUG_PREFIX} repetida`;

  const first = await post(actor, validBody(title));
  const second = await post(actor, validBody(title));

  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 201);

  const a = first.json().data.slug;
  const b = second.json().data.slug;
  assert.notEqual(a, b, "duas vagas da mesma cidade não podem dividir o slug");
  assert.equal(a, `${SLUG_PREFIX}-repetida`);
  assert.equal(b, `${SLUG_PREFIX}-repetida-2`);
}

/** e) O MESMO título em cidades diferentes: mesmo slug, sem conflito. */
async function testSameTitleOtherCityKeepsSlug(): Promise<void> {
  const company = await makeCompany(POCOS);
  const title = `${SLUG_PREFIX} vizinha`;

  // A MESMA empresa publica nas duas cidades: é a cidade escolhida no corpo,
  // e não a do CNPJ, que separa uma vaga da outra.
  const here = await post(company, validBody(title, POCOS));
  const there = await post(company, validBody(title, ANDRADAS));

  assert.equal(here.statusCode, 201);
  assert.equal(there.statusCode, 201);
  assert.equal(here.json().data.slug, there.json().data.slug);
  assert.notEqual(here.json().data.citySlug, there.json().data.citySlug);

  // A URL é o par (cidade, slug): é ele que precisa ser único, não o slug.
  const detail = await app.inject({
    method: "GET",
    url: `/v1/jobs/${there.json().data.citySlug}/${there.json().data.slug}`,
  });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().data.id, there.json().data.id);
}

/**
 * A cidade da vaga é ESCOLHIDA, não herdada da empresa. Um buffet de Poços
 * atende formatura em Andradas o tempo todo, e é a cidade do trabalho que
 * decide quem é notificado (§16.2) e qual página o Google indexa. Registrada
 * na cidade errada, a vaga avisa as pessoas erradas e ninguém descobre por quê.
 */
async function testJobLandsInTheChosenCity(): Promise<void> {
  const company = await makeCompany(POCOS);
  const title = `${SLUG_PREFIX} escolhida`;

  const published = await post(company, validBody(title, ANDRADAS));
  assert.equal(published.statusCode, 201);

  const job = published.json().data;
  assert.equal(job.cityId, ANDRADAS);
  assert.equal(job.cityName, "Andradas");

  const listedIn = async (citySlug: string): Promise<string[]> => {
    const response = await app.inject({
      method: "GET",
      url: `/v1/jobs?city=${citySlug}&from=${encodeURIComponent(new Date(Date.now() + day).toISOString())}`,
    });
    assert.equal(response.statusCode, 200);
    return response.json().data.items.map((item: { id: string }) => item.id);
  };

  assert.ok(
    (await listedIn(job.citySlug)).includes(job.id),
    "a vaga tem que aparecer na listagem de Andradas",
  );

  const pocosCity = await prisma.city.findUniqueOrThrow({
    where: { id: POCOS },
    select: { slug: true },
  });
  assert.ok(
    !(await listedIn(pocosCity.slug)).includes(job.id),
    "a vaga NÃO pode aparecer na listagem da cidade da empresa",
  );
}

/** Id de município bem-formado que não existe na tabela: 400, não vaga órfã. */
async function testUnknownCityIsRejected(): Promise<void> {
  const company = await makeCompany(POCOS);
  const response = await post(
    company,
    validBody(`${SLUG_PREFIX} inexistente`, "9999999"),
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "city_not_found");
  assert.equal(
    await prisma.jobPost.count({ where: { companyId: company.companyId } }),
    0,
  );
}

const tests: Array<[string, () => Promise<void>]> = [
  [
    "linguagem discriminatória: 400 e tentativa registrada",
    testDiscriminatoryIsBlockedAndLogged,
  ],
  ["assinatura suspensa não publica", testSuspendedCannotPublish],
  ["fechar vaga de outra empresa responde 404", testCloseForeignJobIs404],
  [
    "mesmo título na mesma cidade: slugs diferentes",
    testSameTitleSameCityGetsDistinctSlugs,
  ],
  ["mesmo título em outra cidade: mesmo slug", testSameTitleOtherCityKeepsSlug],
  [
    "vaga cai na cidade escolhida, não na da empresa",
    testJobLandsInTheChosenCity,
  ],
  ["cidade inexistente responde 400", testUnknownCityIsRejected],
];

try {
  for (const [name, run] of tests) {
    await cleanup();
    await run();
    console.log(`ok — ${name}`);
  }
  console.log(`\nok — ${tests.length} testes de publicar e fechar vaga`);
} finally {
  await cleanup();
  await app.close();
  await prisma.$disconnect();
}
