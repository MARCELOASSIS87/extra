import type { ApiResult } from "@extra/shared/types/api";
import type { Application } from "@extra/shared/types/application";
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
 * POST /v1/applications/:id/contacted [empresa] — grava quando a empresa toca
 * em "Falar no WhatsApp" (§16.5). O clique é o ato de escolher: só a empresa
 * inicia o contato, então só ela chega aqui. É o dado que mede candidatura
 * versus contato real, e o que alimenta a marcação de presença (§16.7).
 */
export async function markApplicationContacted(
  id: string,
): Promise<ApiResult<Application>> {
  const companyId = await getCurrentCompanyId();
  return withMock(() => {
    const application = store.applications.find((item) => item.id === id);
    if (!application)
      return err("application_not_found", "Candidatura não encontrada.");

    const job = store.jobPosts.find(
      (item) => item.id === application.jobPostId,
    );
    if (!job || job.companyId !== companyId) {
      return err("forbidden", "Esta candidatura é de outra empresa.");
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
 * GET /v1/me/applications com a vaga junto: a home do trabalhador precisa da
 * data e do título para separar a confirmação de véspera (§16.3) das outras
 * candidaturas. Ordenado pela vaga mais próxima primeiro.
 */
export async function listMyApplicationsWithJob(): Promise<
  ApiResult<{ application: Application; job: PublicJobPost }[]>
> {
  const workerId = await getCurrentWorkerId();
  return withMock(() =>
    ok(
      store.applications
        .filter((item) => item.workerId === workerId)
        .flatMap((application) => {
          const job = store.jobPosts.find(
            (item) => item.id === application.jobPostId,
          );
          return job ? [{ application, job: toPublicJobPost(job) }] : [];
        })
        .sort((a, b) => a.job.startsAt.localeCompare(b.job.startsAt)),
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
 * Tela "candidatos da vaga": shortCode, perfil de candidato e o telefone do
 * trabalhador — escopado à empresa dona da vaga (§16.5). O telefone nunca é
 * exibido como texto: só alimenta o botão que abre o WhatsApp.
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
      workerPhone: string;
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
            worker: toApplicantProfile(worker),
            workerPhone: worker.phone,
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
