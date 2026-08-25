import assert from "node:assert/strict";
import type { ApiResult } from "@extra/shared/types/api";
import { closeJob, createJob, getJobBySlug, listJobs } from "./jobs";
import {
  applyToJob,
  confirmApplication,
  listJobApplicants,
  listJobCandidates,
  markApplicationContacted,
  listMyApplications,
  withdrawApplication,
} from "./applications";
import { disputeAttendance, markAttendance } from "./attendance";
import { createWorker, updateMyWorkerProfile } from "./workers";
import { createCompany, listMyCompanyJobs } from "./companies";
import { CURRENT_TERMS_VERSION } from "@extra/shared/constants/terms";
import { getCurrentCompanyId, getCurrentWorkerId, store } from "./mock";

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

  const bySlug = unwrap(
    await call(() => getJobBySlug(firstPage.items[0].slug)),
  );
  assert.equal(bySlug?.id, firstPage.items[0].id);
  assert.equal(unwrap(await call(() => getJobBySlug("nao-existe"))), null);

  // --- publicação de vaga -----------------------------------------------------
  const validJob = {
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
    unwrap(await call(() => getJobBySlug(created.slug)))?.id === created.id,
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
  assert.ok(
    candidate.worker.fullName.length > 0,
    "WorkerApplicantProfile traz o nome completo",
  );
  assert.ok(
    !("cpf" in candidate.worker) && !("birthDate" in candidate.worker),
    "WorkerApplicantProfile não carrega CPF nem data de nascimento",
  );
  assert.equal(candidate.application.contactedAt, null);

  const contacted = unwrap(
    await call(() => markApplicationContacted(candidate.application.id)),
  );
  assert.notEqual(
    contacted.contactedAt,
    null,
    "o clique da empresa em Falar no WhatsApp grava contactedAt",
  );

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
  assert.equal(
    new Date(record.expiresAt).getUTCFullYear() -
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

  const disputed = unwrap(await call(() => disputeAttendance(record.id)));
  assert.equal(disputed.status, "disputed");
  assert.notEqual(disputed.disputedAt, null);
  expectError(
    await call(() => disputeAttendance(record.id)),
    "already_disputed",
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
