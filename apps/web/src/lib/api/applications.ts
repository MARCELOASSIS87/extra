import type { ApiResult } from "@extra/shared/types/api";
import type { Application } from "@extra/shared/types/application";
import type { JobPost } from "@extra/shared/types/job";
import type { WorkerPublicProfile } from "@extra/shared/types/worker";
import {
  getCurrentCompanyId,
  getCurrentWorkerId,
  nowIso,
  randomId,
  randomShortCode,
  store,
  toPublicProfile,
  withMock,
} from "./mock";
import { err, ok } from "./result";

/** POST /v1/jobs/:id/applications — 409 se atingiu maxApplications (§16.5). */
export async function applyToJob(
  jobId: string,
): Promise<ApiResult<Application>> {
  const workerId = await getCurrentWorkerId();
  return withMock(() => {
    const job = store.jobPosts.find((item) => item.id === jobId);
    if (!job) return err("job_not_found", "Vaga não encontrada.");
    if (job.status !== "open")
      return err("job_not_open", "Esta vaga não está mais aberta.");
    if (job.applicationsCount >= job.maxApplications) {
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
 * POST /v1/applications/:id/contacted — grava quando o trabalhador toca em
 * "Falar no WhatsApp" (§16.5). É o dado que mede candidatura vs. contato real.
 */
export async function markApplicationContacted(
  id: string,
): Promise<ApiResult<Application>> {
  const workerId = await getCurrentWorkerId();
  return withMock(() => {
    const application = store.applications.find((item) => item.id === id);
    if (!application)
      return err("application_not_found", "Candidatura não encontrada.");
    if (application.workerId !== workerId) {
      return err("forbidden", "Esta candidatura é de outra pessoa.");
    }

    const updated: Application = { ...application, contactedAt: nowIso() };
    store.applications = store.applications.map((item) =>
      item.id === id ? updated : item,
    );
    return ok(updated);
  });
}

/** GET /v1/me/applications — mais recentes primeiro. */
export async function listMyApplications(): Promise<ApiResult<Application[]>> {
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
 * POST /v1/applications/:id/confirm — confirmação de véspera (§16.3).
 * Não confirmar não gera falta: é aviso, não punição.
 */
export async function confirmApplication(
  id: string,
): Promise<ApiResult<Application>> {
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
 * Tela "candidatos da vaga": shortCode, perfil público e o telefone do
 * trabalhador — só aparece aqui, escopado à empresa dona da vaga em que ele
 * se candidatou (§16.5, revelação espelhada da do lado do trabalhador).
 */
export async function listJobCandidates(jobId: string): Promise<
  ApiResult<
    {
      application: Application;
      worker: WorkerPublicProfile;
      workerPhone: string;
    }[]
  >
> {
  const companyId = await getCurrentCompanyId();
  return withMock(() => {
    const job = store.jobPosts.find((item) => item.id === jobId);
    if (!job) return err("job_not_found", "Vaga não encontrada.");
    if (job.companyId !== companyId) {
      return err("forbidden", "Esta vaga é de outra empresa.");
    }

    const candidates = store.applications
      .filter(
        (item) => item.jobPostId === jobId && item.status !== "withdrawn",
      )
      .flatMap((application) => {
        const worker = store.workers.find(
          (w) => w.id === application.workerId,
        );
        if (!worker) return [];
        return [
          {
            application,
            worker: toPublicProfile(worker),
            workerPhone: worker.phone,
          },
        ];
      })
      .sort((a, b) =>
        a.application.appliedAt.localeCompare(b.application.appliedAt),
      );

    return ok(candidates);
  });
}

/**
 * Candidatos ainda não avaliados (status `applied`) das vagas da empresa,
 * mais recentes primeiro — é a fila de "candidatos novos" do painel.
 */
export async function listNewApplicants(): Promise<
  ApiResult<
    { application: Application; job: JobPost; worker: WorkerPublicProfile }[]
  >
> {
  const companyId = await getCurrentCompanyId();
  return withMock(() => {
    const items = store.applications
      .filter((item) => item.status === "applied")
      .flatMap((item) => {
        const job = store.jobPosts.find((j) => j.id === item.jobPostId);
        if (!job || job.companyId !== companyId) return [];
        const worker = store.workers.find((w) => w.id === item.workerId);
        if (!worker) return [];
        return [{ application: item, job, worker: toPublicProfile(worker) }];
      })
      .sort((a, b) =>
        b.application.appliedAt.localeCompare(a.application.appliedAt),
      );

    return ok(items);
  });
}
