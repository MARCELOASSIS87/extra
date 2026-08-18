import type { ApiResult } from "@extra/shared/types/api";
import type { Application } from "@extra/shared/types/application";
import type { WorkerPublicProfile } from "@extra/shared/types/worker";
import {
  CURRENT_COMPANY_ID,
  CURRENT_WORKER_ID,
  nowIso,
  randomId,
  store,
  toPublicProfile,
  withMock,
} from "./mock";
import { err, ok } from "./result";

/** POST /v1/jobs/:id/applications */
export async function applyToJob(
  jobId: string,
): Promise<ApiResult<Application>> {
  return withMock(() => {
    const job = store.jobPosts.find((item) => item.id === jobId);
    if (!job) return err("job_not_found", "Vaga não encontrada.");
    if (job.status !== "open")
      return err("job_not_open", "Esta vaga não está mais aberta.");

    const already = store.applications.some(
      (item) => item.jobPostId === jobId && item.workerId === CURRENT_WORKER_ID,
    );
    if (already)
      return err("already_applied", "Você já se candidatou a esta vaga.");

    const application: Application = {
      id: randomId(),
      jobPostId: jobId,
      workerId: CURRENT_WORKER_ID,
      status: "applied",
      appliedAt: nowIso(),
      confirmedAt: null,
    };

    store.applications = [...store.applications, application];
    return ok(application);
  });
}

/** GET /v1/me/applications — mais recentes primeiro. */
export async function listMyApplications(): Promise<ApiResult<Application[]>> {
  return withMock(() =>
    ok(
      store.applications
        .filter((item) => item.workerId === CURRENT_WORKER_ID)
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
  return withMock(() => {
    const application = store.applications.find((item) => item.id === id);
    if (!application)
      return err("application_not_found", "Candidatura não encontrada.");
    if (application.workerId !== CURRENT_WORKER_ID) {
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
  return withMock(() => {
    const application = store.applications.find((item) => item.id === id);
    if (!application)
      return err("application_not_found", "Candidatura não encontrada.");
    if (application.workerId !== CURRENT_WORKER_ID) {
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
  return withMock(() => {
    const job = store.jobPosts.find((item) => item.id === jobId);
    if (!job) return err("job_not_found", "Vaga não encontrada.");
    if (job.companyId !== CURRENT_COMPANY_ID) {
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
