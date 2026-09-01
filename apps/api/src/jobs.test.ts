import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

/**
 * As quatro travas das rotas públicas de leitura (§8). Roda contra o Postgres
 * local por `app.inject`, sem abrir porta.
 *
 * Cada uma existe por uma falha que já aconteceu ou que só aparece tarde:
 * lista vazia por slug errado, vaga fechada visível na busca, detalhe
 * indexado virando 404, e N+1 — que passa despercebido com 3 vagas de teste e
 * derruba a listagem com 300.
 */
process.env.WHATSAPP_BUSINESS_NUMBER ??= "5535999999999";

const { prisma } = await import("./db.js");
const { buildServer } = await import("./server.js");
const { JOBS_PAGE_SIZE } = await import("@extra/shared/schemas/job");
const { maxApplicationsFor } = await import("@extra/shared/lib/job");

// Prefixo próprio em tudo que é único, para a limpeza não encostar em dado
// de verdade.
const SLUG_PREFIX = "teste-22a";
const PHONE = "+5535922000001";
const DOCUMENT = "00000000000191";
const CITY_ID = "3151800"; // Poços de Caldas — MG

const app = buildServer();
await app.ready();

let queries = 0;
prisma.$on("query", () => {
  queries += 1;
});

async function cleanup(): Promise<void> {
  await prisma.jobPost.deleteMany({
    where: { slug: { startsWith: SLUG_PREFIX } },
  });
  await prisma.company.deleteMany({ where: { document: DOCUMENT } });
  await prisma.account.deleteMany({ where: { phone: PHONE } });
}

const day = 24 * 60 * 60 * 1000;

/**
 * As vagas do teste começam bem longe no futuro, e toda listagem que confere
 * quantidade filtra por `from` a partir daqui. Sem essa janela o teste conta
 * também o que o seed de desenvolvimento (`pnpm -F api seed`) deixou no banco
 * — foi assim que ele começou a falhar quando o seed passou a existir, e uma
 * contagem que depende da tabela estar vazia é armadilha, não teste.
 */
const FUTURE = new Date(Date.now() + 365 * day);
const FROM = FUTURE.toISOString();

type JobSeed = {
  slug: string;
  role?: "garcom" | "barman";
  status?: "open" | "filled" | "cancelled" | "expired";
  startsInDays?: number;
  expired?: boolean;
};

async function seed(jobs: JobSeed[]): Promise<{ citySlug: string }> {
  const account = await prisma.account.create({
    data: { phone: PHONE, phoneVerifiedAt: new Date() },
  });
  await prisma.company.create({
    data: {
      accountId: account.id,
      document: DOCUMENT,
      legalName: "Empresa de Teste LTDA",
      tradeName: "Buffet Teste",
      responsibleName: "Fulano",
      email: "teste@example.com",
      cityId: CITY_ID,
    },
  });
  const company = await prisma.company.findUniqueOrThrow({
    where: { document: DOCUMENT },
    select: { id: true },
  });

  await prisma.jobPost.createMany({
    data: jobs.map((job, index) => {
      const startsAt = new Date(
        FUTURE.getTime() + day * ((job.startsInDays ?? index) + 1),
      );
      return {
        companyId: company.id,
        cityId: CITY_ID,
        slug: job.slug,
        role: job.role ?? "garcom",
        title: `Vaga de teste ${index}`,
        description: "Vaga criada pelo teste automático.",
        startsAt,
        endsAt: new Date(startsAt.getTime() + 4 * 60 * 60 * 1000),
        payAmount: 150,
        address: "Rua de Teste, 1",
        neighborhood: "Centro",
        vacancies: 2,
        status: job.status ?? "open",
        expiresAt: job.expired
          ? new Date(Date.now() - day)
          : new Date(startsAt.getTime() + day),
      };
    }),
  });

  const city = await prisma.city.findUniqueOrThrow({
    where: { id: CITY_ID },
    select: { slug: true },
  });
  return { citySlug: city.slug };
}

/**
 * a) Slug de cidade que não existe é 404, nunca lista vazia. Lista vazia por
 * erro de digitação é falha silenciosa: quem digitou errado conclui que não
 * há vaga na cidade dele, e nunca conta a ninguém.
 */
async function testUnknownCityIs404(): Promise<void> {
  const response = await app.inject({
    method: "GET",
    url: "/v1/jobs?city=cidade-que-nao-existe-zz",
  });

  assert.equal(response.statusCode, 404);
  const body = response.json();
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "city_not_found");
}

/** b) A listagem só devolve vaga `open` e não vencida. */
async function testListingOnlyOpen(): Promise<void> {
  const { citySlug } = await seed([
    { slug: `${SLUG_PREFIX}-aberta` },
    { slug: `${SLUG_PREFIX}-preenchida`, status: "filled" },
    { slug: `${SLUG_PREFIX}-cancelada`, status: "cancelled" },
    { slug: `${SLUG_PREFIX}-vencida`, status: "expired", expired: true },
    // Aberta no banco, mas o instante já passou: some da listagem sem
    // depender do cron ter rodado.
    { slug: `${SLUG_PREFIX}-aberta-vencida`, expired: true },
  ]);

  const response = await app.inject({
    method: "GET",
    url: `/v1/jobs?city=${citySlug}&from=${encodeURIComponent(FROM)}`,
  });

  assert.equal(response.statusCode, 200);
  const { data } = response.json();
  const mine = data.items.filter((job: { slug: string }) =>
    job.slug.startsWith(SLUG_PREFIX),
  );

  assert.equal(mine.length, 1);
  assert.equal(mine[0].slug, `${SLUG_PREFIX}-aberta`);
  for (const job of data.items) assert.equal(job.status, "open");

  // O join e a derivação da regra, no mesmo lugar em que já temos a vaga.
  assert.equal(mine[0].companyName, "Buffet Teste");
  assert.equal(mine[0].cityName, "Poços de Caldas");
  assert.equal(mine[0].maxApplications, maxApplicationsFor(2));
  assert.equal(data.pageSize, JOBS_PAGE_SIZE);
  assert.ok(response.headers["cache-control"]?.toString().includes("s-maxage"));
}

/**
 * c) Detalhe de vaga vencida responde 200 com o status dela. 404 aqui joga
 * fora a indexação que a página já conquistou no Google.
 */
async function testExpiredDetailIs200(): Promise<void> {
  const { citySlug } = await seed([
    { slug: `${SLUG_PREFIX}-vencida`, status: "expired", expired: true },
  ]);

  const response = await app.inject({
    method: "GET",
    url: `/v1/jobs/${citySlug}/${SLUG_PREFIX}-vencida`,
  });

  assert.equal(response.statusCode, 200);
  const { data } = response.json();
  assert.equal(data.status, "expired");
  assert.equal(data.citySlug, citySlug);
}

/**
 * d) A listagem faz um número FIXO de consultas, não uma por vaga. É a única
 * forma de travar o N+1: ele passa despercebido com 3 vagas de fixture e
 * derruba a rota com 300 em produção.
 */
async function testFixedQueryCount(): Promise<void> {
  const many = Array.from({ length: 8 }, (_, index) => ({
    slug: `${SLUG_PREFIX}-garcom-${index}`,
    role: "garcom" as const,
  }));
  const { citySlug } = await seed([
    ...many,
    { slug: `${SLUG_PREFIX}-barman-0`, role: "barman" as const },
  ]);

  const count = async (url: string): Promise<[number, number]> => {
    queries = 0;
    const response = await app.inject({ method: "GET", url });
    assert.equal(response.statusCode, 200);
    // Os eventos de consulta chegam pelo emissor do Prisma, não pelo retorno
    // da promessa. Sem esta folga o último deles não entrou na conta.
    await delay(50);
    return [queries, response.json().data.items.length];
  };

  const window = `city=${citySlug}&from=${encodeURIComponent(FROM)}`;
  const [oneQueries, oneItems] = await count(`/v1/jobs?${window}&role=barman`);
  const [manyQueries, manyItems] = await count(
    `/v1/jobs?${window}&role=garcom`,
  );

  // Sem estas duas o teste passaria vazio: contador quebrado dá 0 = 0, e
  // duas listas do mesmo tamanho não provam nada sobre laço.
  assert.ok(oneQueries > 0, "o contador de consultas não recebeu evento");
  assert.equal(oneItems, 1);
  assert.equal(manyItems, 8);
  assert.equal(
    manyQueries,
    oneQueries,
    `consulta por vaga: ${oneItems} vaga em ${oneQueries} consultas, ${manyItems} vagas em ${manyQueries}`,
  );
}

const tests: Array<[string, () => Promise<void>]> = [
  ["slug de cidade inexistente devolve 404", testUnknownCityIs404],
  ["listagem só devolve vaga aberta", testListingOnlyOpen],
  ["detalhe de vaga vencida responde 200", testExpiredDetailIs200],
  ["listagem faz número fixo de consultas", testFixedQueryCount],
];

try {
  for (const [name, run] of tests) {
    await cleanup();
    await run();
    console.log(`ok — ${name}`);
  }
  console.log(`\nok — ${tests.length} testes das rotas públicas de leitura`);
} finally {
  await cleanup();
  await app.close();
  await prisma.$disconnect();
}
