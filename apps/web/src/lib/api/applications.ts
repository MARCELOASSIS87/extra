import type { ApiResult } from "@extra/shared/types/api";
import type {
  Application,
  ApplicationContact,
  JobCandidates,
  MyApplication,
  NewApplicant,
} from "@extra/shared/types/application";
import { effectiveAttendanceStatus } from "@extra/shared/lib/attendance";
import type { PublicJobPost } from "@extra/shared/types/job";
import { toPublicJobPost } from "./jobs";
import type { AttendanceStatus } from "@extra/shared/types/attendance";
import type {
  WorkerApplicantProfile,
  WorkerPublicProfile,
} from "@extra/shared/types/worker";
import {
  getCurrentCompanyId,
  getCurrentWorkerId,
  nowIso,
  randomId,
  randomShortCode,
  store,
  toApplicantProfile,
  toPublicProfile,
  withMock,
} from "./mock";
import { maxApplicationsFor } from "@extra/shared/lib/job";
import { cityDistanceKm } from "./cities";
import { isLiveMode, request } from "./http";
import { err, ok } from "./result";

/**
 * POST /v1/jobs/:id/applications — 409 no teto do §16.5. O teto é recalculado
 * de `vacancies` na hora, e não lido de `job.maxApplications`: se a empresa
 * mudar o número de vagas, quem manda é a regra, não a cópia que veio no
 * payload. Quem exibe (job-apply-panel) lê o campo; quem decide, calcula.
 */
export async function applyToJob(
  jobId: string,
): Promise<ApiResult<Application>> {
  // Não há checagem de cidade aqui, e é de propósito (§16.2): cidade assinada
  // decide quem recebe AVISO. Ver e se candidatar é livre — quem achou a vaga
  // sabe se consegue chegar melhor do que a plataforma.
  if (isLiveMode) {
    return request<Application>(
      `/v1/jobs/${encodeURIComponent(jobId)}/applications`,
      { method: "POST" },
    );
  }

  const workerId = await getCurrentWorkerId();
  return withMock(() => {
    const job = store.jobPosts.find((item) => item.id === jobId);
    if (!job) return err("job_not_found", "Vaga não encontrada.");
    if (job.status !== "open")
      return err("job_not_open", "Esta vaga não está mais aberta.");
    if (job.applicationsCount >= maxApplicationsFor(job.vacancies)) {
      return err(
        "job_applications_full",
        "Esta vaga já tem candidatos suficientes.",
      );
    }

    const already = store.applications.some(
      (item) => item.jobPostId === jobId && item.workerId === workerId,
    );
    if (already)
      return err("already_applied", "Você já se candidatou a esta vaga.");

    const application: Application = {
      id: randomId(),
      shortCode: randomShortCode(),
      jobPostId: jobId,
      workerId,
      status: "applied",
      appliedAt: nowIso(),
      contactedAt: null,
      confirmedAt: null,
    };

    store.applications = [...store.applications, application];
    store.jobPosts = store.jobPosts.map((item) =>
      item.id === jobId
        ? { ...item, applicationsCount: item.applicationsCount + 1 }
        : item,
    );
    return ok(application);
  });
}

/**
 * GET /v1/applications/:id/contact [empresa] — a ÚNICA porta por onde um
 * telefone sai (§16.5, regra 8). A lista de candidatos não carrega telefone
 * nenhum: quem quer falar pede aqui, e o ato de pedir É o ato de escolher.
 *
 * `contactedAt` é gravado na primeira chamada e nunca reescrito — a data da
 * escolha é a da primeira vez. Chamar de novo devolve o mesmo telefone e a
 * mesma data, igual à rota real.
 */
export async function getApplicationContact(
  applicationId: string,
): Promise<ApiResult<ApplicationContact>> {
  if (isLiveMode) {
    return request<ApplicationContact>(
      `/v1/applications/${encodeURIComponent(applicationId)}/contact`,
    );
  }

  const companyId = await getCurrentCompanyId();
  return withMock(() => {
    const application = store.applications.find(
      (item) => item.id === applicationId,
    );
    if (!application) {
      return err("not_found", "Candidatura não encontrada.");
    }

    const job = store.jobPosts.find(
      (item) => item.id === application.jobPostId,
    );
    // Candidatura de outra empresa responde igual a inexistente: dizer
    // "é de outra empresa" já confirma que o id existe.
    if (!job || job.companyId !== companyId) {
      return err("not_found", "Candidatura não encontrada.");
    }

    const worker = store.workers.find(
      (item) => item.id === application.workerId,
    );
    if (!worker) return err("not_found", "Candidatura não encontrada.");

    const contactedAt = application.contactedAt ?? nowIso();
    if (!application.contactedAt) {
      const updated: Application = { ...application, contactedAt };
      store.applications = store.applications.map((item) =>
        item.id === applicationId ? updated : item,
      );
    }

    // O nome completo sai junto com o telefone: é a mesma decisão (§16.5).
    return ok({
      applicationId,
      phone: worker.phone,
      fullName: worker.fullName,
      contactedAt,
    });
  });
}

/** GET /v1/me/applications — mais recentes primeiro. */
export async function listMyApplications(): Promise<ApiResult<Application[]>> {
  if (isLiveMode) {
    // A rota devolve a candidatura COM a vaga; aqui só a candidatura importa.
    const result = await request<MyApplication[]>("/v1/me/applications");
    if (!result.ok) return result;
    return ok(result.data.map((item) => item.application));
  }

  const workerId = await getCurrentWorkerId();
  return withMock(() =>
    ok(
      store.applications
        .filter((item) => item.workerId === workerId)
        .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)),
    ),
  );
}

/**
 * GET /v1/me/applications com a vaga junto: a home do trabalhador precisa da
 * data e do título para separar a confirmação de véspera (§16.3) das outras
 * candidaturas. Ordenado pela vaga mais próxima primeiro.
 */
export async function listMyApplicationsWithJob(): Promise<
  ApiResult<MyApplication[]>
> {
  if (isLiveMode) {
    // A rota já devolve `MyApplication[]`, com `attendanceStatus` derivado
    // pelo servidor — a tela nunca conclui falta de um silêncio (§16.7).
    const result = await request<MyApplication[]>("/v1/me/applications");
    if (!result.ok) return result;
    // O mock ordena pela vaga mais próxima; a rota, pela candidatura mais
    // recente. A ordem é da tela, então reordena aqui.
    return ok(
      [...result.data].sort((a, b) =>
        a.job.startsAt.localeCompare(b.job.startsAt),
      ),
    );
  }

  const workerId = await getCurrentWorkerId();
  return withMock(() => {
    const now = nowIso();
    return ok(
      store.applications
        .filter((item) => item.workerId === workerId)
        .flatMap((application) => {
          const job = store.jobPosts.find(
            (item) => item.id === application.jobPostId,
          );
          if (!job) return [];

          const record = store.attendanceRecords.find(
            (item) =>
              item.jobPostId === job.id &&
              item.workerId === application.workerId,
          );

          // O trabalho ainda não acabou: não há desfecho nenhum para mostrar.
          // Depois disso quem responde é a função compartilhada — e o que ela
          // devolve para o silêncio da empresa é `not_selected`, nunca falta.
          const attendanceStatus =
            job.endsAt > now
              ? null
              : effectiveAttendanceStatus(
                  record ?? { status: "pending", markedAt: null },
                  job.endsAt,
                  now,
                );

          return [{ application, job: toPublicJobPost(job), attendanceStatus }];
        })
        .sort((a, b) => a.job.startsAt.localeCompare(b.job.startsAt)),
    );
  });
}

/**
 * POST /v1/applications/:id/confirm — confirmação de véspera (§16.3).
 * Não confirmar não gera falta: é aviso, não punição.
 */
export async function confirmApplication(
  id: string,
): Promise<ApiResult<Application>> {
  if (isLiveMode) {
    return request<Application>(
      `/v1/applications/${encodeURIComponent(id)}/confirm`,
      { method: "POST" },
    );
  }

  const workerId = await getCurrentWorkerId();
  return withMock(() => {
    const application = store.applications.find((item) => item.id === id);
    if (!application)
      return err("application_not_found", "Candidatura não encontrada.");
    if (application.workerId !== workerId) {
      return err("forbidden", "Esta candidatura é de outra pessoa.");
    }
    if (application.status === "withdrawn") {
      return err("application_withdrawn", "Você retirou esta candidatura.");
    }

    const updated: Application = {
      ...application,
      status: "confirmed",
      confirmedAt: nowIso(),
    };
    store.applications = store.applications.map((item) =>
      item.id === id ? updated : item,
    );
    return ok(updated);
  });
}

/** O trabalhador retira a candidatura. Retirar não gera falta. */
export async function withdrawApplication(
  id: string,
): Promise<ApiResult<Application>> {
  // TODO: sem rota. Retirar candidatura não tem endpoint — só confirmar.
  // Espera `POST /v1/applications/:id/withdraw`.
  if (isLiveMode) {
    return err("not_implemented", "Ainda não é possível retirar por aqui.");
  }

  const workerId = await getCurrentWorkerId();
  return withMock(() => {
    const application = store.applications.find((item) => item.id === id);
    if (!application)
      return err("application_not_found", "Candidatura não encontrada.");
    if (application.workerId !== workerId) {
      return err("forbidden", "Esta candidatura é de outra pessoa.");
    }

    const updated: Application = {
      ...application,
      status: "withdrawn",
      confirmedAt: null,
    };
    store.applications = store.applications.map((item) =>
      item.id === id ? updated : item,
    );
    return ok(updated);
  });
}

/**
 * GET /v1/jobs/:id/applicants — a empresa recebe WorkerPublicProfile, nunca o
 * Worker completo: sem CPF e sem data de nascimento saindo daqui.
 */
export async function listJobApplicants(
  jobId: string,
): Promise<ApiResult<WorkerPublicProfile[]>> {
  if (isLiveMode) {
    const result = await request<JobCandidates>(
      `/v1/jobs/${encodeURIComponent(jobId)}/applicants`,
    );
    if (!result.ok) return result;
    return ok(result.data.candidates.map((item) => item.worker));
  }

  const companyId = await getCurrentCompanyId();
  return withMock(() => {
    const job = store.jobPosts.find((item) => item.id === jobId);
    if (!job) return err("job_not_found", "Vaga não encontrada.");
    if (job.companyId !== companyId) {
      return err("forbidden", "Esta vaga é de outra empresa.");
    }

    const profiles = store.applications
      .filter((item) => item.jobPostId === jobId && item.status !== "withdrawn")
      .map((item) =>
        store.workers.find((worker) => worker.id === item.workerId),
      )
      .filter((worker) => worker !== undefined)
      .map(toPublicProfile);

    return ok(profiles);
  });
}

/**
 * Tela "candidatos da vaga": shortCode e perfil de candidato, escopado à
 * empresa dona da vaga (§16.5).
 *
 * SEM telefone, e é o ponto: uma vaga de seis aceita dezoito candidaturas, e
 * uma lista que carrega dezoito números é uma lista telefônica que basta abrir
 * o DevTools para copiar — não importa que a tela não os desenhe. Quem quer
 * falar pede um número por vez em `getApplicationContact()`, e o pedido fica
 * registrado como a escolha que é (regra 8).
 *
 * `presentWithCompany` conta as presenças que ESTA empresa já registrou para
 * ele ("você já contratou fulano N vezes"); `attendanceStatus` é o que ela já
 * marcou nesta vaga, para a tela não oferecer marcar duas vezes.
 */
export async function listJobCandidates(jobId: string): Promise<
  ApiResult<{
    job: PublicJobPost;
    candidates: {
      application: Application;
      worker: WorkerApplicantProfile;
      /**
       * Entre os centros do município dele e o da vaga. `null` quando o par
       * não está na tabela de vizinhança (acima de 100 km) — a tela escreve
       * "cerca de", nunca um número exato.
       */
      distanceKm: number | null;
      presentWithCompany: number;
      attendanceStatus: AttendanceStatus | null;
    }[];
  }>
> {
  if (isLiveMode) {
    return request<JobCandidates>(
      `/v1/jobs/${encodeURIComponent(jobId)}/applicants`,
    );
  }

  const companyId = await getCurrentCompanyId();
  return withMock(() => {
    const job = store.jobPosts.find((item) => item.id === jobId);
    if (!job) return err("job_not_found", "Vaga não encontrada.");
    if (job.companyId !== companyId) {
      return err("forbidden", "Esta vaga é de outra empresa.");
    }

    const candidates = store.applications
      .filter((item) => item.jobPostId === jobId && item.status !== "withdrawn")
      .flatMap((application) => {
        const worker = store.workers.find((w) => w.id === application.workerId);
        if (!worker) return [];
        return [
          {
            application,
            worker: toApplicantProfile(worker, application.contactedAt),
            distanceKm: cityDistanceKm(worker.cityId, job.cityId),
            presentWithCompany: store.attendanceRecords.filter(
              (record) =>
                record.workerId === worker.id &&
                record.companyId === companyId &&
                record.status === "present",
            ).length,
            attendanceStatus:
              store.attendanceRecords.find(
                (record) =>
                  record.jobPostId === jobId && record.workerId === worker.id,
              )?.status ?? null,
          },
        ];
      })
      .sort((a, b) =>
        a.application.appliedAt.localeCompare(b.application.appliedAt),
      );

    // A vaga vem junto: as duas telas da empresa precisam dela (título, data,
    // valor da mensagem do §16.5) e ela já foi validada aqui.
    return ok({ job: toPublicJobPost(job), candidates });
  });
}

/**
 * Candidatos ainda não avaliados (status `applied`) das vagas da empresa,
 * mais recentes primeiro — é a fila de "candidatos novos" do painel.
 */
export async function listNewApplicants(): Promise<
  ApiResult<
    {
      application: Application;
      job: PublicJobPost;
      worker: WorkerPublicProfile;
    }[]
  >
> {
  if (isLiveMode) {
    return request<NewApplicant[]>("/v1/companies/me/applicants");
  }

  const companyId = await getCurrentCompanyId();
  return withMock(() => {
    const items = store.applications
      .filter((item) => item.status === "applied")
      .flatMap((item) => {
        const job = store.jobPosts.find((j) => j.id === item.jobPostId);
        if (!job || job.companyId !== companyId) return [];
        const worker = store.workers.find((w) => w.id === item.workerId);
        if (!worker) return [];
        return [
          {
            application: item,
            job: toPublicJobPost(job),
            worker: toPublicProfile(worker),
          },
        ];
      })
      .sort((a, b) =>
        b.application.appliedAt.localeCompare(a.application.appliedAt),
      );

    return ok(items);
  });
}
