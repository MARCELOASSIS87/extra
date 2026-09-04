import assert from "node:assert/strict";

/**
 * O TESTE DE SIMETRIA do §16.2.
 *
 * Há duas implementações da mesma regra, e elas TÊM que concordar:
 *
 *   - `countRoutedWorkers(vaga)`  → dada uma vaga, quem é avisado (o push)
 *   - `routedJobIdsForWorker(id)` → dado um trabalhador, que vagas ele vê (o feed)
 *
 * A propriedade, para todo par (trabalhador, vaga):
 *
 *   a vaga aparece no feed daquele trabalhador
 *   SE E SOMENTE SE
 *   aquele trabalhador é contado no alcance daquela vaga
 *
 * Se as duas direções discordarem, uma de duas coisas acontece, e as duas
 * fazem a pessoa concluir que o site está quebrado: o feed mostra vaga que
 * nunca vai notificar, ou o push chega de uma vaga que não está na lista.
 *
 * As duas direções são SQL escrito à mão, em arquivos diferentes, com os
 * predicados na ordem inversa — é exatamente o tipo de par que sai de
 * sincronia num refactor sem ninguém perceber. Este teste é o que trava.
 */
process.env.WHATSAPP_BUSINESS_NUMBER ??= "5535999999999";

const { prisma } = await import("./db.js");
const { countRoutedWorkers, routedJobIdsForWorker } = await import(
  "./routing.js"
);

const PHONE_PREFIX = "+5535955";
const DOCUMENT_PREFIX = "5500000000";
const CPF_PREFIX = "550";

// Cidades de verdade, com a distância que está na tabela de vizinhança.
const POCOS = "3151800"; // a cidade da vaga
const CALDAS = "3110301"; // 25 km de Poços
const CACONDE = "3508702"; // 29 km de Poços

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

let seq = 0;

async function makeCompanyId(): Promise<string> {
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
      document: `${DOCUMENT_PREFIX}${String(seq).padStart(4, "0")}`.slice(0, 14),
      legalName: `Empresa ${seq} LTDA`,
      tradeName: `Simetria ${seq}`,
      responsibleName: "Fulano de Teste",
      email: `simetria${seq}@example.com`,
      cityId: POCOS,
      subscriptionStatus: "active",
    },
  });
  return company.id;
}

interface WorkerSpec {
  /** Onde mora — âncora do raio. */
  cityId: string;
  /** Cidades assinadas na mão. Vazio = só o raio pode alcançar. */
  notificationCityIds: string[];
  nearbyRadiusKm: 25 | 50 | null;
  roles: ("garcom" | "cozinheiro")[];
  availability: { weekday: number; period: "morning" | "afternoon" | "night" }[];
}

async function makeWorker(spec: WorkerSpec): Promise<string> {
  seq += 1;
  const account = await prisma.account.create({
    data: {
      phone: `${PHONE_PREFIX}${String(seq).padStart(5, "0")}`,
      phoneVerifiedAt: new Date(),
    },
  });
  const worker = await prisma.worker.create({
    data: {
      accountId: account.id,
      firstName: `Trabalhador${seq}`,
      lastName: "de Teste",
      cpf: `${CPF_PREFIX}${String(seq).padStart(8, "0")}`,
      birthDate: new Date("1990-05-20"),
      cityId: spec.cityId,
      neighborhood: "Centro",
      experience: "Experiência de teste.",
      // `complete` porque as duas direções só consideram cadastro concluído.
      status: "complete",
      nearbyRadiusKm: spec.nearbyRadiusKm,
      termsVersion: "v1",
      termsAcceptedAt: new Date(),
      termsAcceptedIp: "127.0.0.1",
      roles: { create: spec.roles.map((role) => ({ role })) },
      notificationCities: {
        create: spec.notificationCityIds.map((cityId) => ({ cityId })),
      },
      availability: { create: spec.availability },
    },
  });
  return worker.id;
}

interface JobSpec {
  cityId: string;
  role: "garcom" | "cozinheiro";
  reach: "unrestricted" | "city_only" | "nearby";
  reachRadiusKm: number | null;
  /** Instante de início, em UTC. */
  startsAt: Date;
}

async function makeJob(companyId: string, spec: JobSpec): Promise<string> {
  seq += 1;
  const job = await prisma.jobPost.create({
    data: {
      companyId,
      cityId: spec.cityId,
      slug: `vaga-simetria-${seq}`,
      role: spec.role,
      title: "Vaga para teste de simetria",
      description: "Criada pelo teste automático.",
      startsAt: spec.startsAt,
      endsAt: new Date(spec.startsAt.getTime() + 4 * 60 * 60 * 1000),
      payAmount: 150,
      address: "Rua de Teste, 1",
      neighborhood: "Centro",
      vacancies: 2,
      reach: spec.reach,
      reachRadiusKm: spec.reachRadiusKm,
      // Aberta e não vencida: o feed só considera essas, e o teste compara as
      // duas direções sobre o mesmo universo.
      status: "open",
      expiresAt: new Date(spec.startsAt.getTime() + 4 * 60 * 60 * 1000),
    },
  });
  return job.id;
}

/**
 * O próximo sábado às 22h em Poços (01:00 UTC do domingo seguinte). Uma hora
 * que cai em DIAS diferentes nos dois fusos de propósito: é onde um dos lados
 * calcular o dia da semana em UTC apareceria como divergência.
 */
function nextSaturdayNight(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7 || 7));
  // 01:00 UTC de domingo = 22:00 de sábado em São Paulo.
  d.setUTCHours(1, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

const SATURDAY_NIGHT = { weekday: 6, period: "night" as const };
const MONDAY_MORNING = { weekday: 1, period: "morning" as const };

/**
 * A verificação: para cada par, as duas direções respondem a mesma coisa.
 * `expected` é o que a REGRA do §16.2 manda — as duas são conferidas contra
 * ele, e não uma contra a outra: duas implementações erradas do mesmo jeito
 * concordariam entre si e passariam.
 */
async function assertSymmetric(
  label: string,
  workerId: string,
  jobId: string,
  expected: boolean,
): Promise<void> {
  const job = await prisma.jobPost.findUniqueOrThrow({
    where: { id: jobId },
    select: {
      cityId: true,
      role: true,
      reach: true,
      reachRadiusKm: true,
      startsAt: true,
    },
  });

  // Direção 1 — dada a vaga, quem é avisado (o push).
  const reached = await countRoutedWorkers({
    cityId: job.cityId,
    role: job.role,
    reach: job.reach,
    reachRadiusKm: job.reachRadiusKm,
    startsAt: job.startsAt.toISOString(),
  });
  // A contagem é sobre a base inteira; o que importa é se ESTE entrou. Como o
  // teste limpa tudo antes, a base é só o que ele criou.
  const push = await pushReaches(workerId, jobId);

  // Direção 2 — dado o trabalhador, que vagas ele vê (o feed).
  const feed = (await routedJobIdsForWorker(workerId)).includes(jobId);

  assert.equal(
    push,
    expected,
    `${label}: o push ${push ? "alcança" : "não alcança"}, mas a regra diz que ${expected ? "deveria" : "não deveria"}`,
  );
  assert.equal(
    feed,
    expected,
    `${label}: o feed ${feed ? "mostra" : "não mostra"}, mas a regra diz que ${expected ? "deveria" : "não deveria"}`,
  );
  assert.equal(
    feed,
    push,
    `${label}: AS DUAS DIREÇÕES DISCORDAM — feed=${feed}, push=${push}`,
  );
  assert.ok(reached >= 0);
}

/** Se aquele trabalhador está entre os alcançados por aquela vaga. */
async function pushReaches(workerId: string, jobId: string): Promise<boolean> {
  const job = await prisma.jobPost.findUniqueOrThrow({
    where: { id: jobId },
    select: {
      cityId: true,
      role: true,
      reach: true,
      reachRadiusKm: true,
      startsAt: true,
    },
  });
  const { routedWorkerIds } = await import("./routing.js");
  const ids = await routedWorkerIds({
    cityId: job.cityId,
    role: job.role,
    reach: job.reach,
    reachRadiusKm: job.reachRadiusKm,
    startsAt: job.startsAt.toISOString(),
  });
  return ids.includes(workerId);
}

/** a) Cidade assinada na mão: alcança, e o raio nem precisa existir. */
async function testSubscribedCity(): Promise<void> {
  const companyId = await makeCompanyId();
  const jobId = await makeJob(companyId, {
    cityId: POCOS,
    role: "garcom",
    reach: "unrestricted",
    reachRadiusKm: null,
    startsAt: nextSaturdayNight(),
  });

  // Mora longe, raio DESLIGADO, mas assinou Poços na mão.
  const worker = await makeWorker({
    cityId: CACONDE,
    notificationCityIds: [POCOS],
    nearbyRadiusKm: null,
    roles: ["garcom"],
    availability: [SATURDAY_NIGHT],
  });

  await assertSymmetric("cidade assinada", worker, jobId, true);
}

/** b) Chegando pelo raio: não assinou, mas mora a 25 km e ligou 50. */
async function testArrivesByRadius(): Promise<void> {
  const companyId = await makeCompanyId();
  const jobId = await makeJob(companyId, {
    cityId: POCOS,
    role: "garcom",
    reach: "unrestricted",
    reachRadiusKm: null,
    startsAt: nextSaturdayNight(),
  });

  const worker = await makeWorker({
    cityId: CALDAS, // 25 km de Poços
    notificationCityIds: [CALDAS], // assinou a PRÓPRIA cidade, não a da vaga
    nearbyRadiusKm: 50,
    roles: ["garcom"],
    availability: [SATURDAY_NIGHT],
  });

  await assertSymmetric("chegou pelo raio", worker, jobId, true);

  // A BORDA do raio do trabalhador, dos dois lados. É o par que pega
  // divergência de raio entre as duas direções: com folga de 25 km, mexer no
  // raio de um dos lados não muda resposta nenhuma e o controle negativo do
  // item 5 passaria sem quebrar.

  // Caldas está a 25 km, e o raio é exatamente 25: `<=`, então alcança.
  const onEdge = await makeWorker({
    cityId: CALDAS,
    notificationCityIds: [CALDAS],
    nearbyRadiusKm: 25,
    roles: ["garcom"],
    availability: [SATURDAY_NIGHT],
  });
  await assertSymmetric("borda do raio: 25 km, raio 25", onEdge, jobId, true);

  // Caconde está a 29 km, e o raio é 25: fora por 4 km. Qualquer afrouxada
  // no raio de UM dos lados vira divergência aqui.
  const justOutside = await makeWorker({
    cityId: CACONDE,
    notificationCityIds: [CACONDE],
    nearbyRadiusKm: 25,
    roles: ["garcom"],
    availability: [SATURDAY_NIGHT],
  });
  await assertSymmetric(
    "logo fora do raio: 29 km, raio 25",
    justOutside,
    jobId,
    false,
  );
}

/**
 * c) Alcance da vaga estreitado. O `reach` filtra APENAS quem chega pelo raio
 * — quem assinou na mão passa de qualquer jeito (§16.2, regra 2).
 */
async function testNarrowedReach(): Promise<void> {
  const companyId = await makeCompanyId();

  const cityOnlyJob = await makeJob(companyId, {
    cityId: POCOS,
    role: "garcom",
    reach: "city_only",
    reachRadiusKm: null,
    startsAt: nextSaturdayNight(),
  });

  // Chega só pelo raio, e a vaga é "só quem mora na cidade": NÃO alcança.
  const neighbor = await makeWorker({
    cityId: CALDAS,
    notificationCityIds: [CALDAS],
    nearbyRadiusKm: 50,
    roles: ["garcom"],
    availability: [SATURDAY_NIGHT],
  });
  await assertSymmetric("city_only barra o vizinho", neighbor, cityOnlyJob, false);

  // Mesma vaga, mas quem ASSINOU Poços na mão passa — mesmo morando fora.
  const subscriber = await makeWorker({
    cityId: CALDAS,
    notificationCityIds: [POCOS],
    nearbyRadiusKm: null,
    roles: ["garcom"],
    availability: [SATURDAY_NIGHT],
  });
  await assertSymmetric(
    "inscrição explícita vence o city_only",
    subscriber,
    cityOnlyJob,
    true,
  );

  // `nearby` com raio menor que a distância: 25 km de distância, teto de 10.
  const nearbyJob = await makeJob(companyId, {
    cityId: POCOS,
    role: "garcom",
    reach: "nearby",
    reachRadiusKm: 10,
    startsAt: nextSaturdayNight(),
  });
  await assertSymmetric("nearby com raio curto", neighbor, nearbyJob, false);

  // O mesmo `nearby`, com raio que cobre os 25 km.
  const wideJob = await makeJob(companyId, {
    cityId: POCOS,
    role: "garcom",
    reach: "nearby",
    reachRadiusKm: 30,
    startsAt: nextSaturdayNight(),
  });
  await assertSymmetric("nearby com raio suficiente", neighbor, wideJob, true);
}

/** d) Disponibilidade incompatível: assinou a cidade, mas não trabalha no dia. */
async function testIncompatibleAvailability(): Promise<void> {
  const companyId = await makeCompanyId();
  const jobId = await makeJob(companyId, {
    cityId: POCOS,
    role: "garcom",
    reach: "unrestricted",
    reachRadiusKm: null,
    startsAt: nextSaturdayNight(),
  });

  // Só segunda de manhã: a vaga é sábado à noite.
  const wrongSlot = await makeWorker({
    cityId: POCOS,
    notificationCityIds: [POCOS],
    nearbyRadiusKm: null,
    roles: ["garcom"],
    availability: [MONDAY_MORNING],
  });
  await assertSymmetric("disponibilidade incompatível", wrongSlot, jobId, false);

  // Função incompatível, tudo o mais igual.
  const wrongRole = await makeWorker({
    cityId: POCOS,
    notificationCityIds: [POCOS],
    nearbyRadiusKm: null,
    roles: ["cozinheiro"],
    availability: [SATURDAY_NIGHT],
  });
  await assertSymmetric("função incompatível", wrongRole, jobId, false);

  // E o controle positivo do mesmo par: com o slot certo, alcança.
  const rightSlot = await makeWorker({
    cityId: POCOS,
    notificationCityIds: [POCOS],
    nearbyRadiusKm: null,
    roles: ["garcom"],
    availability: [SATURDAY_NIGHT, MONDAY_MORNING],
  });
  await assertSymmetric("slot certo entre vários", rightSlot, jobId, true);
}

await cleanup();
try {
  await testSubscribedCity();
  console.log("ok — simetria: cidade assinada");
  await cleanup();

  await testArrivesByRadius();
  console.log("ok — simetria: chegada pelo raio");
  await cleanup();

  await testNarrowedReach();
  console.log("ok — simetria: alcance da vaga estreitado");
  await cleanup();

  await testIncompatibleAvailability();
  console.log("ok — simetria: disponibilidade e função incompatíveis");

  console.log("ok — feed e push concordam nos quatro casos do §16.2");
} finally {
  await cleanup();
  await prisma.$disconnect();
}
