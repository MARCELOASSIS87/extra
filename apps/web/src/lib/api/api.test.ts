import assert from "node:assert/strict";
import type { ApiResult } from "@extra/shared/types/api";
import {
  closeJob,
  countReachedWorkers,
  createJob,
  getJobBySlug,
  listJobs,
  listJobsForMe,
} from "./jobs";
import {
  applyToJob,
  confirmApplication,
  listJobApplicants,
  listJobCandidates,
  getApplicationContact,
  listMyApplications,
  withdrawApplication,
} from "./applications";
import {
  disputeAttendance,
  listAttendancePending,
  markAttendance,
} from "./attendance";
import {
  attendanceExpiresAt,
  isUnderDispute,
} from "@extra/shared/lib/attendance";
import { createWorker, updateMyWorkerProfile } from "./workers";
import { createCompany, listMyCompanyJobs } from "./companies";
import { CURRENT_TERMS_VERSION } from "@extra/shared/constants/terms";
import { getCurrentCompanyId, getCurrentWorkerId, store } from "./mock";
import { DEFAULT_CITY_ID } from "./cities";

/**
 * Toda chave que aparece no payload, em qualquer profundidade. Existe porque
 * conferir o TIPO não prova nada sobre o que sai: o tipo é o que se acredita
 * estar devolvendo, as chaves são o que realmente vai no fio (§16.5, regra 8).
 */
const SECRET_KEYS = ["workerPhone", "phone", "telefone", "cpf", "birthDate"];

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

function assertNoContactKeys(payload: unknown, what: string): void {
  const keys = keysOf(payload);
  for (const key of SECRET_KEYS) {
    assert.ok(!keys.has(key), `a chave "${key}" não pode existir em ${what}`);
  }
}

// A camada falha de propósito em ~5% das chamadas; o teste repete só nesse caso.
async function call<T>(fn: () => Promise<ApiResult<T>>): Promise<ApiResult<T>> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const result = await fn();
    if (result.ok || result.error.code !== "network_error") return result;
  }
  throw new Error(
    "mock falhou 12 vezes seguidas — taxa de erro fora do esperado",
  );
}

const unwrap = <T>(result: ApiResult<T>): T => {
  assert.ok(result.ok, `esperava sucesso, veio ${JSON.stringify(result)}`);
  return result.data;
};

const expectError = <T>(result: ApiResult<T>, code: string) => {
  assert.ok(!result.ok, `esperava erro ${code}, veio sucesso`);
  assert.equal(result.error.code, code);
};

async function main() {
  const currentCompanyId = await getCurrentCompanyId();
  const currentWorkerId = await getCurrentWorkerId();

  // --- listagem pública -------------------------------------------------------
  const firstPage = unwrap(await call(() => listJobs()));
  assert.ok(
    firstPage.items.every((job) => job.status === "open"),
    "listagem só com vaga aberta",
  );
  assert.equal(firstPage.page, 1);
  assert.ok(firstPage.total > 0);
  const highlightedFirst = firstPage.items.findIndex(
    (job) => !job.isHighlighted,
  );
  assert.ok(
    highlightedFirst === -1 ||
      !firstPage.items.slice(highlightedFirst).some((job) => job.isHighlighted),
    "vaga em destaque vem antes",
  );

  const paged = unwrap(await call(() => listJobs({ page: 1, pageSize: 2 })));
  assert.equal(paged.items.length, 2);
  assert.equal(paged.pageSize, 2);

  const filtered = unwrap(await call(() => listJobs({ role: "garcom" })));
  assert.ok(
    filtered.items.every((job) => job.role === "garcom"),
    "filtro por função",
  );

  // --- cidade: aviso é opt-in, navegar não é (§16.2) ---------------------------
  const jobCityId = firstPage.items[0].cityId;
  const otherCity = unwrap(
    await call(() => listJobs({ cityIds: ["3549102"] })),
  );
  assert.equal(otherCity.total, 0, "cidade sem vaga não devolve vaga de outra");
  const sameCity = unwrap(await call(() => listJobs({ cityIds: [jobCityId] })));
  assert.ok(
    sameCity.items.every((job) => job.cityId === jobCityId),
    "filtro por cidade",
  );

  // Estreitar a assinatura muda o que É AVISADO, não o que dá para ver: a
  // listagem pública continua devolvendo tudo, e candidatar-se não checa
  // cidade nenhuma.
  const meBefore = store.workers.find((w) => w.id === currentWorkerId);
  assert.ok(meBefore, "trabalhador atual precisa existir nas fixtures");
  store.workers = store.workers.map((w) =>
    w.id === currentWorkerId ? { ...w, notificationCityIds: ["3549102"] } : w,
  );
  assert.equal(
    unwrap(await call(() => listJobsForMe())).total,
    0,
    "roteamento respeita as cidades assinadas",
  );
  assert.ok(
    unwrap(await call(() => listJobs())).total > 0,
    "a listagem pública não é limitada pelas cidades assinadas",
  );
  store.workers = store.workers.map((w) =>
    w.id === currentWorkerId ? meBefore : w,
  );

  // --- alcance da vaga: só estreita, e nunca fura o opt-in (§16.2) -------------
  // Cenário montado à mão porque nas fixtures todo mundo assina Poços — o que
  // faria as três opções de alcance darem o mesmo número.
  const workersBefore = store.workers;
  const base = workersBefore[0];
  const POCOS = "3151800";
  const CALDAS = "3110301"; // 25 km de Poços
  store.workers = [
    // Assinou Poços na mão, morando em Caldas: sempre recebe.
    {
      ...base,
      id: "reach-inscrito",
      status: "complete",
      roles: ["garcom"],
      cityId: CALDAS,
      notificationCityIds: [POCOS],
      nearbyRadiusKm: null,
    },
    // Chega pela vizinhança: é este que o alcance da empresa filtra.
    {
      ...base,
      id: "reach-vizinho",
      status: "complete",
      roles: ["garcom"],
      cityId: CALDAS,
      notificationCityIds: [CALDAS],
      nearbyRadiusKm: 50,
    },
  ];

  const reached = (
    reach: "unrestricted" | "nearby" | "city_only",
    km: number | null = null,
  ) =>
    countReachedWorkers({
      cityId: POCOS,
      role: "garcom",
      reach,
      reachRadiusKm: km,
    });

  assert.equal(await reached("unrestricted"), 2, "padrão alcança os dois");
  assert.equal(
    await reached("city_only"),
    1,
    "inscrição explícita passa por city_only; quem vem pelo raio, não",
  );
  assert.equal(
    await reached("nearby", 10),
    1,
    "raio da empresa menor que a distância corta só quem vem pela vizinhança",
  );
  assert.equal(await reached("nearby", 50), 2);
  store.workers = workersBefore;

  const first = firstPage.items[0];
  const bySlug = unwrap(
    await call(() => getJobBySlug(first.citySlug, first.slug)),
  );
  assert.equal(bySlug?.id, first.id);
  assert.equal(
    unwrap(await call(() => getJobBySlug(first.citySlug, "nao-existe"))),
    null,
  );
  // O slug só é único DENTRO da cidade: a cidade errada não pode achar a vaga.
  assert.equal(
    unwrap(await call(() => getJobBySlug("cidade-que-nao-existe", first.slug))),
    null,
    "slug certo em cidade errada não devolve vaga",
  );

  // --- publicação de vaga -----------------------------------------------------
  const validJob = {
    cityId: DEFAULT_CITY_ID,
    role: "garcom" as const,
    title: "Garçom para evento de teste",
    description: "Atendimento de mesas em evento corporativo no centro.",
    date: "2027-03-14",
    startTime: "18:00",
    endTime: "23:00",
    payAmount: 180,
    payNote: null,
    address: "Rua Assis Figueiredo, 500",
    neighborhood: "Centro",
    requirements: null,
    vacancies: 2,
    providesTransport: false,
    // Padrão do formulário: alcance mais aberto possível.
    reach: "unrestricted" as const,
    reachRadiusKm: null,
  };

  // O filtro do §14.1 vale na camada de dados, não só no formulário.
  expectError(
    await call(() =>
      createJob({ ...validJob, title: "Moça para servir mesa" }),
    ),
    "validation_error",
  );
  expectError(
    await call(() => createJob({ ...validJob, payAmount: -5 })),
    "validation_error",
  );
  // Valor do bico é real inteiro: centavo nunca entra (§ ajuste de valor).
  expectError(
    await call(() => createJob({ ...validJob, payAmount: 150.5 })),
    "validation_error",
  );

  const created = unwrap(await call(() => createJob(validJob)));
  assert.equal(created.status, "open");
  assert.equal(created.companyId, currentCompanyId);
  assert.ok(created.slug.startsWith("garcom-para-evento-de-teste-"));
  assert.ok(
    unwrap(await call(() => getJobBySlug(created.citySlug, created.slug)))
      ?.id === created.id,
    "vaga criada aparece na busca por slug",
  );
  assert.ok(
    unwrap(await call(() => listMyCompanyJobs())).some(
      (job) => job.id === created.id,
    ),
    "vaga criada aparece no painel da empresa",
  );

  // --- candidatura ------------------------------------------------------------
  const application = unwrap(await call(() => applyToJob(created.id)));
  assert.equal(application.status, "applied");
  assert.equal(application.workerId, currentWorkerId);
  expectError(await call(() => applyToJob(created.id)), "already_applied");
  expectError(await call(() => applyToJob("id-inexistente")), "job_not_found");

  const mine = unwrap(await call(() => listMyApplications()));
  assert.ok(
    mine.some((item) => item.id === application.id),
    "candidatura aparece na lista",
  );
  assert.ok(
    mine.every((item) => item.workerId === currentWorkerId),
    "lista traz só as candidaturas da própria pessoa",
  );

  const confirmed = unwrap(
    await call(() => confirmApplication(application.id)),
  );
  assert.equal(confirmed.status, "confirmed");
  assert.notEqual(confirmed.confirmedAt, null);

  // --- a empresa vê perfil público, nunca o cadastro inteiro ------------------
  const applicants = unwrap(await call(() => listJobApplicants(created.id)));
  assert.ok(applicants.length > 0);
  for (const profile of applicants) {
    assert.ok(!("cpf" in profile), "WorkerPublicProfile não carrega CPF");
    assert.ok(
      !("birthDate" in profile),
      "WorkerPublicProfile não carrega data de nascimento",
    );
    assert.ok(
      !("phone" in profile),
      "WorkerPublicProfile não carrega telefone",
    );
  }

  // --- §16.5: quem inicia o contato é a empresa ------------------------------
  const candidatesResult = unwrap(
    await call(() => listJobCandidates(created.id)),
  );
  const candidate = candidatesResult.candidates.find(
    (item) => item.worker.id === currentWorkerId,
  );
  assert.ok(candidate, "candidato aparece para a empresa dona da vaga");
  // O nome completo passa pelo MESMO portão do telefone (§16.5, regra 8):
  // antes de a empresa chamar, é null — e o primeiro nome com a inicial
  // continuam vindo, para a tela nunca ficar sem nome nenhum.
  assert.equal(
    candidate.worker.fullName,
    null,
    "o nome completo não sai antes de a empresa chamar",
  );
  assert.ok(
    candidate.worker.firstName.length > 0 &&
      candidate.worker.lastNameInitial.length > 0,
    "antes do contato a tela ainda tem primeiro nome e inicial",
  );
  assert.ok(
    !("cpf" in candidate.worker) && !("birthDate" in candidate.worker),
    "WorkerApplicantProfile não carrega CPF nem data de nascimento",
  );
  // Antes de a empresa chamar, ninguém foi escolhido.
  assert.equal(candidate.application.contactedAt, null);

  assertNoContactKeys(candidatesResult.candidates, "na lista de candidatos");

  // O clique em "Falar no WhatsApp" é o ato de escolher: é ele que pede o
  // telefone e é ele que grava contactedAt.
  const contact = unwrap(
    await call(() => getApplicationContact(candidate.application.id)),
  );
  assert.ok(contact.phone.startsWith("+55"), "o contato devolve o telefone");
  assert.ok(
    contact.fullName.length > 0,
    "o contato devolve o nome completo junto com o telefone",
  );
  assert.notEqual(
    contact.contactedAt,
    null,
    "o clique da empresa em Falar no WhatsApp grava contactedAt",
  );

  // Chamar de novo não reescreve a data: a escolha aconteceu na primeira vez.
  const again = unwrap(
    await call(() => getApplicationContact(candidate.application.id)),
  );
  assert.equal(again.contactedAt, contact.contactedAt);
  assert.equal(again.phone, contact.phone);

  // Depois de chamar, a lista passa a trazer o nome completo — e SÓ daquela
  // candidatura: os outros candidatos da mesma vaga continuam com null.
  const afterContact = unwrap(await call(() => listJobCandidates(created.id)));
  const contacted = afterContact.candidates.find(
    (item) => item.worker.id === currentWorkerId,
  );
  assert.equal(contacted?.worker.fullName, contact.fullName);
  for (const other of afterContact.candidates) {
    if (other.worker.id === currentWorkerId) continue;
    assert.equal(
      other.worker.fullName,
      null,
      "chamar um candidato não abre o nome dos outros",
    );
  }

  const withdrawn = unwrap(
    await call(() => withdrawApplication(application.id)),
  );
  assert.equal(withdrawn.status, "withdrawn");
  assert.ok(
    !unwrap(await call(() => listJobApplicants(created.id))).some(
      (profile) => profile.id === currentWorkerId,
    ),
    "quem retira a candidatura sai da lista da empresa",
  );

  // --- fechamento da vaga -----------------------------------------------------
  const closed = unwrap(await call(() => closeJob(created.id)));
  assert.equal(closed.status, "filled");
  expectError(await call(() => closeJob(created.id)), "job_not_open");
  expectError(await call(() => applyToJob(created.id)), "job_not_open");

  // --- presença ---------------------------------------------------------------
  const now = new Date().toISOString();
  const pastJob = store.jobPosts.find(
    (job) => job.companyId === currentCompanyId && job.endsAt < now,
  );
  assert.ok(pastJob, "fixtures precisam de uma vaga passada da empresa atual");

  expectError(
    await call(() =>
      markAttendance(created.id, {
        workerId: currentWorkerId,
        status: "present",
      }),
    ),
    "job_not_finished",
  );
  expectError(
    await call(() =>
      markAttendance(pastJob.id, {
        workerId: "quem-nao-existe",
        status: "present",
      }),
    ),
    "worker_not_applicant",
  );

  // Candidatura antiga na vaga já realizada, para poder marcar presença.
  store.applications = [
    ...store.applications.filter(
      (item) =>
        !(item.jobPostId === pastJob.id && item.workerId === currentWorkerId),
    ),
    {
      id: "seed-para-teste-de-presenca",
      shortCode: "TEST",
      jobPostId: pastJob.id,
      workerId: currentWorkerId,
      status: "confirmed",
      appliedAt: pastJob.publishedAt,
      contactedAt: null,
      confirmedAt: pastJob.startsAt,
    },
  ];
  store.attendanceRecords = store.attendanceRecords.filter(
    (item) =>
      !(item.jobPostId === pastJob.id && item.workerId === currentWorkerId),
  );

  const record = unwrap(
    await call(() =>
      markAttendance(pastJob.id, {
        workerId: currentWorkerId,
        status: "present",
      }),
    ),
  );
  assert.equal(record.status, "present");
  assert.equal(record.disputedAt, null);
  assert.ok(record.markedAt, "marcação carimba markedAt");
  assert.ok(
    !("expiresAt" in record),
    "expiração é markedAt + 12 meses, calculada na leitura — não é coluna",
  );
  assert.equal(
    new Date(attendanceExpiresAt(record.markedAt)).getUTCFullYear() -
      new Date(record.markedAt).getUTCFullYear(),
    1,
    "presença expira em 12 meses",
  );
  expectError(
    await call(() =>
      markAttendance(pastJob.id, {
        workerId: currentWorkerId,
        status: "absent",
      }),
    ),
    "attendance_already_marked",
  );

  // A fila de marcação não carrega telefone pela mesma razão da lista de
  // candidatos: quem quiser falar dali pede um número por vez, e o pedido
  // registra o contato. Varrido por CHAVE, não pelo tipo.
  const pendingList = unwrap(await call(() => listAttendancePending()));
  assertNoContactKeys(pendingList, "na fila de marcação de presença");
  assert.ok(
    pendingList.every((item) => typeof item.applicationId === "string"),
    "a fila precisa do applicationId para pedir o contato",
  );

  const presentBefore =
    unwrap(await call(() => listJobCandidates(pastJob.id))).candidates.find(
      (item) => item.worker.id === currentWorkerId,
    )?.worker.attendance.present ?? 0;

  // Contestar não apaga a marcação: o status continua sendo o que a empresa
  // marcou, e é a dimensão de contestação que tira o registro da conta.
  const disputed = unwrap(await call(() => disputeAttendance(record.id)));
  assert.equal(disputed.status, "present", "a marcação original sobrevive");
  assert.notEqual(disputed.disputedAt, null);
  assert.equal(disputed.disputeResolvedAt, null);
  assert.equal(isUnderDispute(disputed), true);
  expectError(
    await call(() => disputeAttendance(record.id)),
    "already_disputed",
  );

  // Item que importa da contestação: ela sai da CONTAGEM pública, não do
  // registro. E "novo por aqui" é decisão do servidor, não da tela lendo zero.
  const afterDispute = unwrap(
    await call(() => listJobCandidates(pastJob.id)),
  ).candidates.find((item) => item.worker.id === currentWorkerId);
  assert.ok(afterDispute, "o candidato contestado continua na lista");
  assert.equal(
    afterDispute.worker.attendance.present,
    presentBefore - 1,
    "contestado sai da contagem pública",
  );
  assert.equal(
    afterDispute.worker.attendance.hasHistory,
    afterDispute.worker.attendance.present > 0 ||
      afterDispute.worker.attendance.absent > 0,
    "hasHistory vem do servidor, não de a tela interpretar um zero",
  );

  // Registro antigo das fixtures: o prazo de 7 dias já passou.
  const oldRecord = store.attendanceRecords.find(
    (item) => item.workerId === currentWorkerId && item.id !== record.id,
  );
  if (oldRecord) {
    const result = await call(() => disputeAttendance(oldRecord.id));
    assert.ok(
      !result.ok &&
        ["dispute_window_closed", "already_disputed"].includes(
          result.error.code,
        ),
    );
  }

  // --- cadastro ---------------------------------------------------------------
  // Não existe cadastro sem consentimento registrado.
  const accepted = {
    termsVersion: CURRENT_TERMS_VERSION,
    termsAccepted: true,
    // Cidade e bairro entram na etapa 1 junto com a identidade: é o que
    // localiza a pessoa e vira a primeira cidade de aviso (§16.2).
    cityId: DEFAULT_CITY_ID,
    neighborhood: "Centro",
  };
  const underage = new Date();
  underage.setUTCFullYear(underage.getUTCFullYear() - 16);
  expectError(
    await call(() =>
      createWorker({
        fullName: "Menor de Idade",
        cpf: "111.444.777-35",
        birthDate: underage.toISOString().slice(0, 10),
        ...accepted,
      }),
    ),
    "validation_error",
  );

  const adult = new Date();
  adult.setUTCFullYear(adult.getUTCFullYear() - 25);
  const newWorker = unwrap(
    await call(() =>
      createWorker({
        fullName: "Trabalhador de Teste",
        cpf: "111.444.777-35",
        birthDate: adult.toISOString().slice(0, 10),
        ...accepted,
      }),
    ),
  );
  assert.equal(newWorker.status, "incomplete");
  // Cidade e bairro informados na etapa 1 são gravados, e a cidade vira a
  // primeira assinatura de aviso — sem isso o cadastro nasce sem rotear nada.
  assert.equal(newWorker.cityId, DEFAULT_CITY_ID);
  assert.equal(newWorker.neighborhood, "Centro");
  assert.deepEqual(newWorker.notificationCityIds, [DEFAULT_CITY_ID]);
  assert.equal(newWorker.termsVersion, CURRENT_TERMS_VERSION);
  assert.ok(newWorker.termsAcceptedAt !== "", "aceite carimbado no servidor");
  assert.equal(newWorker.profileCompletedAt, null);
  expectError(
    await call(() =>
      createWorker({
        fullName: "Outro Qualquer",
        cpf: "111.444.777-35",
        birthDate: adult.toISOString().slice(0, 10),
        ...accepted,
      }),
    ),
    "cpf_already_registered",
  );

  const patched = unwrap(
    await call(() => updateMyWorkerProfile({ neighborhood: "Granbery" })),
  );
  assert.equal(patched.neighborhood, "Granbery");
  assert.equal(patched.id, currentWorkerId);
  expectError(
    await call(() => updateMyWorkerProfile({ phone: "sem-formato-e164" })),
    "validation_error",
  );

  expectError(
    await call(() =>
      createCompany({
        cnpj: "11.222.333/0001-82",
        legalName: "Empresa Inválida LTDA",
        tradeName: "Inválida",
        responsibleName: "Fulano de Tal",
        cityId: DEFAULT_CITY_ID,
        phone: "+5535991258324",
        email: "contato@invalida.com.br",
        termsAccepted: true,
      }),
    ),
    "validation_error",
  );

  const validCompanyInput = {
    cnpj: "99.888.777/0001-00",
    legalName: "Nova Empresa de Teste LTDA",
    tradeName: "Nova Empresa",
    responsibleName: "Responsável de Teste",
    phone: "+5535991258399",
    email: "contato@novaempresa.com.br",
    cityId: DEFAULT_CITY_ID,
  };
  expectError(
    await call(() =>
      createCompany({ ...validCompanyInput, termsAccepted: false }),
    ),
    "validation_error",
  );

  const newCompany = unwrap(
    await call(() =>
      createCompany({ ...validCompanyInput, termsAccepted: true }),
    ),
  );
  assert.equal(newCompany.subscriptionStatus, "trialing");
  assert.notEqual(newCompany.termsAcceptedAt, null);
  expectError(
    await call(() =>
      createCompany({ ...validCompanyInput, termsAccepted: true }),
    ),
    "cnpj_already_registered",
  );

  console.log("api.test.ts: all checks passed");
}

main();
