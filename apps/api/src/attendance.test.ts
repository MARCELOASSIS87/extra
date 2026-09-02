import assert from "node:assert/strict";

/**
 * As seis travas de marcação e contestação (§16.4, §16.7 e a regra 11).
 *
 * A que mais importa é a (e): contestado, o registro sai da CONTAGEM pública
 * e a marcação original sobrevive. Se contestar apagasse o status, a empresa
 * perderia o que registrou e o trabalhador ganharia um apagador — nenhum dos
 * dois é o desenho.
 */
process.env.WHATSAPP_BUSINESS_NUMBER ??= "5535999999999";

const { prisma } = await import("./db.js");
const { buildServer } = await import("./server.js");
const { signSessionToken } = await import("./auth/token.js");
const { AUTO_NOT_SELECTED_DAYS, DISPUTE_WINDOW_DAYS } =
  await import("@extra/shared/lib/attendance");

const PHONE_PREFIX = "+5535955";
const DOCUMENT_PREFIX = "7700000000";
const CPF_PREFIX = "770";
const POCOS = "3151800";
const DAY = 24 * 60 * 60 * 1000;

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
  /** O sufixo numérico do nome, para as asserções sobre o payload. */
  seq: number;
}

let seq = 0;

async function makeCompany(): Promise<Actor> {
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
      legalName: `Empresa ${seq} LTDA`,
      tradeName: `Teste ${seq}`,
      responsibleName: "Fulano de Teste",
      email: `empresa${seq}@example.com`,
      cityId: POCOS,
      subscriptionStatus: "active",
    },
  });
  return { id: company.id, token: await signSessionToken(account.id, 1), seq };
}

async function makeWorker(): Promise<Actor> {
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
      cityId: POCOS,
      neighborhood: "Centro",
      experience: "Experiência de teste.",
      status: "complete",
      termsVersion: "v1",
      termsAcceptedAt: new Date(),
      termsAcceptedIp: "127.0.0.1",
    },
  });
  return { id: worker.id, token: await signSessionToken(account.id, 1), seq };
}

/** `endedDaysAgo` negativo cria vaga que ainda não terminou. */
async function makeJob(company: Actor, endedDaysAgo: number): Promise<string> {
  seq += 1;
  const endsAt = new Date(Date.now() - endedDaysAgo * DAY);
  const job = await prisma.jobPost.create({
    data: {
      companyId: company.id,
      cityId: POCOS,
      slug: `vaga-teste-22d-${seq}`,
      role: "garcom",
      title: "Garçom para teste",
      description: "Vaga criada pelo teste automático.",
      startsAt: new Date(endsAt.getTime() - 4 * 60 * 60 * 1000),
      endsAt,
      payAmount: 150,
      address: "Rua de Teste, 1",
      neighborhood: "Centro",
      vacancies: 2,
      expiresAt: new Date(endsAt.getTime() - 4 * 60 * 60 * 1000),
    },
  });
  return job.id;
}

let shortCode = 0;
async function makeApplication(
  jobPostId: string,
  worker: Actor,
): Promise<string> {
  shortCode += 1;
  const application = await prisma.application.create({
    data: {
      jobPostId,
      workerId: worker.id,
      shortCode: String(1000 + shortCode).slice(0, 4),
    },
  });
  return application.id;
}

const mark = (company: Actor, jobId: string, body: unknown) =>
  app.inject({
    method: "POST",
    url: `/v1/jobs/${jobId}/attendance`,
    headers: { authorization: `Bearer ${company.token}` },
    payload: body as Record<string, unknown>,
  });

const dispute = (worker: Actor, recordId: string) =>
  app.inject({
    method: "POST",
    url: `/v1/attendance/${recordId}/dispute`,
    headers: { authorization: `Bearer ${worker.token}` },
  });

const publicCount = async (workerId: string) => {
  const [row] = await prisma.$queryRaw<
    { present: bigint; absent: bigint; has_history: boolean }[]
  >`SELECT present, absent, has_history FROM worker_attendance_summary
     WHERE worker_id = ${workerId}::uuid`;
  return {
    present: Number(row.present),
    absent: Number(row.absent),
    hasHistory: row.has_history,
  };
};

/** a) Marcar em vaga de outra empresa: 404, e nada gravado. */
async function testMarkForeignJobIs404(): Promise<void> {
  const owner = await makeCompany();
  const stranger = await makeCompany();
  const worker = await makeWorker();
  const jobId = await makeJob(owner, 1);
  const applicationId = await makeApplication(jobId, worker);

  const response = await mark(stranger, jobId, {
    applicationId,
    status: "present",
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "not_found");
  assert.equal(
    await prisma.attendanceRecord.count({ where: { applicationId } }),
    0,
    "a recusa não pode ter gravado marcação",
  );
}

/** b) Marcar antes do fim do turno: 409. A pessoa ainda pode chegar. */
async function testMarkBeforeEndIs409(): Promise<void> {
  const company = await makeCompany();
  const worker = await makeWorker();
  const jobId = await makeJob(company, -1); // termina amanhã
  const applicationId = await makeApplication(jobId, worker);

  const response = await mark(company, jobId, {
    applicationId,
    status: "present",
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "job_not_finished");
  assert.equal(
    await prisma.attendanceRecord.count({ where: { applicationId } }),
    0,
  );
}

/** c) Contestar registro de outro trabalhador: 404. */
async function testDisputeForeignRecordIs404(): Promise<void> {
  const company = await makeCompany();
  const owner = await makeWorker();
  const stranger = await makeWorker();
  const jobId = await makeJob(company, 1);
  const applicationId = await makeApplication(jobId, owner);

  const marked = await mark(company, jobId, {
    applicationId,
    status: "absent",
  });
  assert.equal(marked.statusCode, 200);
  const recordId = marked.json().data.id;

  const response = await dispute(stranger, recordId);

  assert.equal(response.statusCode, 404);
  const after = await prisma.attendanceRecord.findUniqueOrThrow({
    where: { id: recordId },
  });
  assert.equal(after.disputedAt, null, "a recusa não pode abrir contestação");
}

/** d) Contestar depois de 7 dias: 409. */
async function testDisputeAfterWindowIs409(): Promise<void> {
  const company = await makeCompany();
  const worker = await makeWorker();
  const jobId = await makeJob(company, 30);
  const applicationId = await makeApplication(jobId, worker);

  const marked = await mark(company, jobId, {
    applicationId,
    status: "absent",
  });
  const recordId = marked.json().data.id;

  // Marcação envelhecida direto no banco: a rota carimba `now()`, e o que
  // está sendo testado é o prazo, não o relógio.
  await prisma.attendanceRecord.update({
    where: { id: recordId },
    data: {
      markedAt: new Date(Date.now() - (DISPUTE_WINDOW_DAYS + 1) * DAY),
    },
  });

  const response = await dispute(worker, recordId);

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "dispute_window_closed");
}

/**
 * e) Contestado, o registro sai da contagem pública; resolvido, volta. E a
 * marcação original sobrevive às duas passagens (regra 11).
 */
async function testDisputeHidesFromPublicCount(): Promise<void> {
  const company = await makeCompany();
  const worker = await makeWorker();
  const jobId = await makeJob(company, 1);
  const applicationId = await makeApplication(jobId, worker);

  const marked = await mark(company, jobId, {
    applicationId,
    status: "present",
  });
  const recordId = marked.json().data.id;

  const before = await publicCount(worker.id);
  assert.equal(before.present, 1);
  assert.equal(before.hasHistory, true);

  const disputed = await dispute(worker, recordId);
  assert.equal(disputed.statusCode, 200);
  assert.equal(
    disputed.json().data.status,
    "present",
    "contestar NÃO altera o status (regra 11)",
  );
  assert.notEqual(disputed.json().data.disputedAt, null);

  const during = await publicCount(worker.id);
  assert.equal(during.present, 0, "contestado sai da contagem");
  assert.equal(during.hasHistory, false);

  // Resolvida a contestação, o registro volta a contar — e continua sendo o
  // que a empresa marcou, não o que a contestação pediu.
  await prisma.attendanceRecord.update({
    where: { id: recordId },
    data: { disputeResolvedAt: new Date(), disputeOutcome: "upheld" },
  });

  const after = await publicCount(worker.id);
  assert.equal(after.present, 1, "resolvido, volta para a contagem");
  const stored = await prisma.attendanceRecord.findUniqueOrThrow({
    where: { id: recordId },
  });
  assert.equal(stored.status, "present", "a marcação original sobreviveu");
}

/**
 * f) Qualquer campo de texto na marcação: 400. Não existe coluna de texto em
 * `attendance_records` e não pode passar a existir — texto livre em avaliação
 * é o que gera ação por dano moral (regra 5).
 */
async function testTextFieldIsRejected(): Promise<void> {
  const company = await makeCompany();
  const worker = await makeWorker();
  const jobId = await makeJob(company, 1);
  const applicationId = await makeApplication(jobId, worker);

  for (const extra of [
    { observacao: "faltou sem avisar" },
    { comment: "ruim" },
    { rating: 2 },
    { notes: "" },
  ]) {
    const response = await mark(company, jobId, {
      applicationId,
      status: "absent",
      ...extra,
    });

    const key = Object.keys(extra)[0];
    assert.equal(response.statusCode, 400, `"${key}" tinha que ser recusado`);
    assert.equal(response.json().error.code, "validation_error");
    assert.equal(
      await prisma.attendanceRecord.count({ where: { applicationId } }),
      0,
      `"${key}" não pode ter gravado nada`,
    );
  }

  // E o corpo limpo passa, para o 400 acima ser sobre a chave e não sobre a rota.
  const clean = await mark(company, jobId, { applicationId, status: "absent" });
  assert.equal(clean.statusCode, 200);
}

/**
 * A derivação do §16.7: passados 7 dias do fim do trabalho sem marcação, a
 * pendência aparece como `not_selected` na leitura — e NUNCA como falta, nem
 * quando a empresa já tinha chamado no WhatsApp (regra 10). O que está
 * GRAVADO continua `pending` nos três casos: a derivação é de leitura, e o
 * cron, se existir um dia, só materializa.
 */
async function testAutoNotSelectedIsDerived(): Promise<void> {
  const company = await makeCompany();

  const readStatus = async (worker: Actor, applicationId: string) => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/me/applications",
      headers: { authorization: `Bearer ${worker.token}` },
    });
    assert.equal(response.statusCode, 200);
    const found = response
      .json()
      .data.find(
        (item: { application: { id: string } }) =>
          item.application.id === applicationId,
      );
    assert.ok(found, "a candidatura tem que aparecer na leitura");
    return found.attendanceStatus;
  };

  const storedStatus = async (applicationId: string) =>
    (await prisma.attendanceRecord.findUnique({ where: { applicationId } }))
      ?.status ?? null;

  // 6 dias: ainda dá para marcar.
  const six = await makeWorker();
  const sixJob = await makeJob(company, 6);
  const sixApplication = await makeApplication(sixJob, six);
  assert.equal(await readStatus(six, sixApplication), "pending");

  // 8 dias: virou o desfecho neutro sozinho.
  const eight = await makeWorker();
  const eightJob = await makeJob(company, 8);
  const eightApplication = await makeApplication(eightJob, eight);
  assert.equal(await readStatus(eight, eightApplication), "not_selected");

  // 8 dias COM contactedAt: a empresa chamou e não marcou. Continua neutro —
  // deduzir falta de um silêncio é exatamente o que a regra 10 proíbe.
  const called = await makeWorker();
  const calledJob = await makeJob(company, 8);
  const calledApplication = await makeApplication(calledJob, called);
  await prisma.application.update({
    where: { id: calledApplication },
    data: { contactedAt: new Date() },
  });
  const calledStatus = await readStatus(called, calledApplication);
  assert.equal(calledStatus, "not_selected");
  assert.notEqual(calledStatus, "absent", "silêncio nunca vira falta");

  // E o banco não mudou em nenhum dos três: ninguém gravou nada.
  for (const applicationId of [
    sixApplication,
    eightApplication,
    calledApplication,
  ]) {
    assert.equal(
      await storedStatus(applicationId),
      null,
      "a derivação não pode gravar linha nenhuma",
    );
  }

  // Com registro pending gravado (a empresa abriu a fila e não concluiu), a
  // leitura deriva igual e o valor gravado segue `pending`.
  const stored = await makeWorker();
  const storedJob = await makeJob(company, 8);
  const storedApplication = await makeApplication(storedJob, stored);
  await prisma.attendanceRecord.create({
    data: { applicationId: storedApplication, status: "pending" },
  });
  assert.equal(await readStatus(stored, storedApplication), "not_selected");
  assert.equal(
    await storedStatus(storedApplication),
    "pending",
    "o status GRAVADO continua pending",
  );
}

/**
 * A fila de marcação da empresa (§16.4): só as vagas dela, só o que ainda cabe
 * marcar, e nenhum telefone.
 */
async function testPendingQueue(): Promise<void> {
  const owner = await makeCompany();
  const stranger = await makeCompany();

  const queueOf = async (company: Actor) => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/companies/me/attendance/pending",
      headers: { authorization: `Bearer ${company.token}` },
    });
    assert.equal(response.statusCode, 200);
    return response;
  };

  // Da empresa dona: terminou ontem, ainda dá para marcar.
  const mine = await makeWorker();
  const myJob = await makeJob(owner, 1);
  const myApplication = await makeApplication(myJob, mine);

  // Da OUTRA empresa, nas mesmas condições.
  const theirs = await makeWorker();
  const theirJob = await makeJob(stranger, 1);
  const theirApplication = await makeApplication(theirJob, theirs);

  // Da empresa dona, mas com 8 dias: já virou not_selected sozinho.
  const stale = await makeWorker();
  const staleJob = await makeJob(owner, 8);
  const staleApplication = await makeApplication(staleJob, stale);

  const response = await queueOf(owner);
  const ids = response
    .json()
    .data.map((item: { applicationId: string }) => item.applicationId);

  assert.ok(
    ids.includes(myApplication),
    "a pendência da empresa tem que estar na fila",
  );
  assert.ok(
    !ids.includes(theirApplication),
    "a fila da empresa A não pode trazer item da empresa B",
  );
  assert.ok(
    !ids.includes(staleApplication),
    "pendência de 8 dias já é not_selected e sai da fila sem cron",
  );

  // A borda, do lado de DENTRO: uma vaga que terminou pouco depois do corte
  // ainda cabe marcar e tem que APARECER. O WHERE e a derivação usam o mesmo
  // instante, então os dois concordam aqui — e é essa concordância que o caso
  // trava. Se um dia o corte do WHERE for calculado de outro jeito (um
  // `now - 7 * dia` no lugar do `setUTCDate`), ele passa a excluir o que a
  // derivação ainda considera pendente, e este assert acusa.
  const edge = await makeWorker();
  const justInside = new Date();
  justInside.setUTCDate(justInside.getUTCDate() - AUTO_NOT_SELECTED_DAYS);
  const edgeEndsAt = new Date(justInside.getTime() + 60_000);
  const edgeJob = await makeJob(
    owner,
    (Date.now() - edgeEndsAt.getTime()) / DAY,
  );
  const edgeApplication = await makeApplication(edgeJob, edge);
  const edgeIds = (await queueOf(owner))
    .json()
    .data.map((item: { applicationId: string }) => item.applicationId);
  assert.ok(
    edgeIds.includes(edgeApplication),
    "dentro do prazo, ainda que na borda, a pendência tem que aparecer",
  );

  // E a empresa B vê a dela, para o teste acima não passar por fila vazia.
  const theirIds = (await queueOf(stranger))
    .json()
    .data.map((item: { applicationId: string }) => item.applicationId);
  assert.ok(theirIds.includes(theirApplication));
  assert.ok(!theirIds.includes(myApplication));

  // Nenhuma chave de telefone, varrido por CHAVE e não pelo tipo (regra 8).
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
  walk(response.json().data);
  // `fullName` NÃO entra na lista: a fila serve o mesmo card de candidato das
  // outras telas da empresa (`WorkerApplicantProfile`, §16.5), e é a mesma
  // empresa que já vê aquele nome na lista de candidatos da vaga. O que a
  // regra 8 proíbe aqui é telefone — e CPF e nascimento, que nunca saem.
  for (const key of ["phone", "workerPhone", "telefone", "cpf", "birthDate"]) {
    assert.ok(!keys.has(key), `a chave "${key}" não pode existir na fila`);
  }
  assert.doesNotMatch(response.body, /\+55/, "telefone no corpo da resposta");

  // O card precisa disto para a empresa lembrar quem foi e em qual vaga.
  const item = response
    .json()
    .data.find(
      (entry: { applicationId: string }) =>
        entry.applicationId === myApplication,
    );
  assert.equal(item.worker.firstName, `Trabalhador${mine.seq}`);
  assert.equal(item.worker.lastNameInitial, "T.");
  assert.equal(item.job.title, "Garçom para teste");
  assert.equal(item.job.role, "garcom");
  assert.equal(item.job.neighborhood, "Centro");
  assert.ok(item.shortCode.length === 4);
}

const tests: Array<[string, () => Promise<void>]> = [
  ["marcar vaga de outra empresa: 404", testMarkForeignJobIs404],
  ["marcar antes do fim do turno: 409", testMarkBeforeEndIs409],
  ["contestar registro de outro: 404", testDisputeForeignRecordIs404],
  ["contestar fora do prazo: 409", testDisputeAfterWindowIs409],
  [
    "contestado sai da contagem e volta ao resolver",
    testDisputeHidesFromPublicCount,
  ],
  ["campo de texto na marcação: 400", testTextFieldIsRejected],
  ["not_selected derivado após 7 dias", testAutoNotSelectedIsDerived],
  ["fila de pendências: só da empresa, só o que cabe marcar", testPendingQueue],
];

try {
  for (const [name, run] of tests) {
    await cleanup();
    await run();
    console.log(`ok — ${name}`);
  }
  console.log(`\nok — ${tests.length} testes de marcação e contestação`);
} finally {
  await cleanup();
  await app.close();
  await prisma.$disconnect();
}
