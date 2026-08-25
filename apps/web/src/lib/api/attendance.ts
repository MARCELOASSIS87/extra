import type { ApiResult } from "@extra/shared/types/api";
import type {
  AttendanceMarkInput,
  AttendanceRecord,
} from "@extra/shared/types/attendance";
import type { JobPost } from "@extra/shared/types/job";
import type { WorkerApplicantProfile } from "@extra/shared/types/worker";
import {
  getCurrentCompanyId,
  getCurrentWorkerId,
  nowIso,
  randomId,
  store,
  toApplicantProfile,
  withMock,
} from "./mock";
import { err, ok } from "./result";

const DISPUTE_WINDOW_DAYS = 7;

/**
 * POST /v1/jobs/:id/attendance — um clique por candidato, sem texto (§16.4).
 * O registro é binário: `AttendanceMarkInput` não aceita nota nem comentário.
 */
export async function markAttendance(
  jobId: string,
  input: AttendanceMarkInput,
): Promise<ApiResult<AttendanceRecord>> {
  const companyId = await getCurrentCompanyId();
  return withMock(() => {
    const job = store.jobPosts.find((item) => item.id === jobId);
    if (!job) return err("job_not_found", "Vaga não encontrada.");
    if (job.companyId !== companyId) {
      return err("forbidden", "Esta vaga é de outra empresa.");
    }
    // Com instante dá para ser exato: o bico terminou, pode marcar. Antes,
    // comparando só a data, a formatura que sai às 2h do domingo só liberava
    // a marcação na segunda.
    if (job.endsAt > nowIso()) {
      return err("job_not_finished", "A vaga ainda não aconteceu.");
    }

    const applied = store.applications.some(
      (item) => item.jobPostId === jobId && item.workerId === input.workerId,
    );
    if (!applied) {
      return err(
        "worker_not_applicant",
        "Esta pessoa não se candidatou à vaga.",
      );
    }

    const already = store.attendanceRecords.some(
      (item) => item.jobPostId === jobId && item.workerId === input.workerId,
    );
    if (already) {
      return err(
        "attendance_already_marked",
        "Presença já registrada para esta vaga.",
      );
    }

    const markedAt = nowIso();
    const expires = new Date(markedAt);
    expires.setUTCFullYear(expires.getUTCFullYear() + 1); // some do perfil em 12 meses

    const record: AttendanceRecord = {
      id: randomId(),
      workerId: input.workerId,
      companyId: job.companyId,
      jobPostId: jobId,
      status: input.status,
      markedAt,
      disputedAt: null,
      expiresAt: expires.toISOString(),
    };

    store.attendanceRecords = [...store.attendanceRecords, record];
    return ok(record);
  });
}

/**
 * Vagas já realizadas com candidato ainda sem presença marcada (§16.4): a
 * pendência que o painel da empresa mostra. Vem com nome, código e telefone
 * porque a empresa marca dias depois do evento e precisa lembrar quem foi e
 * em qual vaga — sem isso a marcação vira chute.
 */
export async function listAttendancePending(): Promise<
  ApiResult<
    {
      job: JobPost;
      worker: WorkerApplicantProfile;
      shortCode: string;
      workerPhone: string;
    }[]
  >
> {
  const companyId = await getCurrentCompanyId();
  return withMock(() => {
    const now = nowIso();
    const items = store.applications
      .filter((item) => item.status !== "withdrawn")
      .flatMap((item) => {
        const job = store.jobPosts.find((j) => j.id === item.jobPostId);
        if (!job || job.companyId !== companyId || job.endsAt > now) {
          return [];
        }
        const alreadyMarked = store.attendanceRecords.some(
          (record) =>
            record.jobPostId === job.id && record.workerId === item.workerId,
        );
        if (alreadyMarked) return [];
        const worker = store.workers.find((w) => w.id === item.workerId);
        if (!worker) return [];
        return [
          {
            job,
            worker: toApplicantProfile(worker),
            shortCode: item.shortCode,
            workerPhone: worker.phone,
          },
        ];
      })
      .sort((a, b) => a.job.startsAt.localeCompare(b.job.startsAt));

    return ok(items);
  });
}

/** Histórico do trabalhador, sem os registros já expirados (12 meses). */
export async function listMyAttendance(): Promise<
  ApiResult<AttendanceRecord[]>
> {
  const workerId = await getCurrentWorkerId();
  return withMock(() => {
    const now = nowIso();
    return ok(
      store.attendanceRecords
        .filter((item) => item.workerId === workerId && item.expiresAt > now)
        .sort((a, b) => b.markedAt.localeCompare(a.markedAt)),
    );
  });
}

/**
 * POST /v1/attendance/:id/dispute — o trabalhador tem 7 dias para contestar.
 * Contestado, o registro sai do perfil público até a resolução (§16.4).
 */
export async function disputeAttendance(
  id: string,
): Promise<ApiResult<AttendanceRecord>> {
  const workerId = await getCurrentWorkerId();
  return withMock(() => {
    const record = store.attendanceRecords.find((item) => item.id === id);
    if (!record) return err("attendance_not_found", "Registro não encontrado.");
    if (record.workerId !== workerId) {
      return err("forbidden", "Este registro é de outra pessoa.");
    }
    if (record.status === "disputed") {
      return err("already_disputed", "Este registro já está em contestação.");
    }

    const deadline = new Date(record.markedAt);
    deadline.setUTCDate(deadline.getUTCDate() + DISPUTE_WINDOW_DAYS);
    if (new Date() > deadline) {
      return err(
        "dispute_window_closed",
        `O prazo de ${DISPUTE_WINDOW_DAYS} dias para contestar já passou.`,
      );
    }

    const updated: AttendanceRecord = {
      ...record,
      status: "disputed",
      disputedAt: nowIso(),
    };
    store.attendanceRecords = store.attendanceRecords.map((item) =>
      item.id === id ? updated : item,
    );
    return ok(updated);
  });
}
