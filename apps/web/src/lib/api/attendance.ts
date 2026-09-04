import type { ApiResult } from "@extra/shared/types/api";
import type {
  AttendanceMarkInput,
  AttendancePendingItem,
  AttendanceRecord,
} from "@extra/shared/types/attendance";
import type { PublicJobPost } from "@extra/shared/types/job";
import { toPublicJobPost } from "./jobs";
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
import {
  attendanceExpiresAt,
  DISPUTE_WINDOW_DAYS,
  effectiveAttendanceStatus,
  isUnderDispute,
} from "@extra/shared/lib/attendance";
import { isLiveMode, request } from "./http";
import { err, ok } from "./result";

/**
 * POST /v1/jobs/:id/attendance — um clique por candidato, sem texto (§16.4).
 * O registro é binário: `AttendanceMarkInput` não aceita nota nem comentário.
 */
export async function markAttendance(
  jobId: string,
  input: AttendanceMarkInput,
): Promise<ApiResult<AttendanceRecord>> {
  if (isLiveMode) {
    return request<AttendanceRecord>(
      `/v1/jobs/${encodeURIComponent(jobId)}/attendance`,
      { method: "POST", body: input },
    );
  }

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

    const record: AttendanceRecord = {
      id: randomId(),
      workerId: input.workerId,
      companyId: job.companyId,
      jobPostId: jobId,
      status: input.status,
      markedAt: nowIso(),
      disputedAt: null,
      disputeResolvedAt: null,
      disputeOutcome: null,
    };

    store.attendanceRecords = [...store.attendanceRecords, record];
    return ok(record);
  });
}

/**
 * Vagas já realizadas com candidato ainda sem presença marcada (§16.4): a
 * pendência que o painel da empresa mostra. Vem com nome, código e vaga porque
 * a empresa marca dias depois do evento e precisa lembrar quem foi e em qual
 * vaga — sem isso a marcação vira chute.
 *
 * SEM telefone, pela mesma razão da lista de candidatos (§16.5, regra 8): uma
 * lista que carrega números é uma lista telefônica, mesmo que a tela não os
 * desenhe. Quem quiser falar pede um por vez em `getApplicationContact()`, e o
 * `applicationId` está aqui justamente para isso — pedir dali registra o
 * contato como a escolha que é.
 */
export async function listAttendancePending(): Promise<
  ApiResult<
    {
      job: PublicJobPost;
      worker: WorkerApplicantProfile;
      applicationId: string;
      shortCode: string;
    }[]
  >
> {
  if (isLiveMode) {
    return request<AttendancePendingItem[]>(
      "/v1/companies/me/attendance/pending",
    );
  }

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
        // `pending` é a ausência de marcação, não uma marcação (§16.7) — um
        // registro nesse estado é a própria fila, e não pode tirar a pessoa
        // dela. Sem esta condição, criar a linha pending faria o candidato
        // sumir do painel sem ninguém ter marcado nada.
        //
        // Depois de 7 dias do fim do trabalho, porém, o silêncio da empresa
        // JÁ É o desfecho: a pendência virou `not_selected` sozinha e não há
        // mais o que marcar. Quem decide isso é a função compartilhada, não
        // uma comparação de data escrita aqui.
        const record = store.attendanceRecords.find(
          (entry) =>
            entry.jobPostId === job.id && entry.workerId === item.workerId,
        );
        const effective = effectiveAttendanceStatus(
          record ?? { status: "pending", markedAt: null },
          job.endsAt,
          now,
        );
        if (effective !== "pending") return [];
        const worker = store.workers.find((w) => w.id === item.workerId);
        if (!worker) return [];
        return [
          {
            job: toPublicJobPost(job),
            worker: toApplicantProfile(worker, item.contactedAt),
            applicationId: item.id,
            shortCode: item.shortCode,
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
  if (isLiveMode) {
    return request<AttendanceRecord[]>("/v1/me/attendance");
  }

  const workerId = await getCurrentWorkerId();
  return withMock(() => {
    const now = nowIso();
    return ok(
      store.attendanceRecords
        // Contestado continua aparecendo para o próprio dono: é dele o
        // registro, e ele precisa ver o que está contestando.
        .filter(
          (item) =>
            item.workerId === workerId &&
            item.markedAt !== null &&
            attendanceExpiresAt(item.markedAt) > now,
        )
        .sort((a, b) => (b.markedAt ?? "").localeCompare(a.markedAt ?? "")),
    );
  });
}

/**
 * POST /v1/attendance/:id/dispute — o trabalhador tem 7 dias para contestar.
 * Contestado, o registro sai da contagem pública até a resolução (§16.4) —
 * sai da CONTAGEM, não do registro: o que a empresa marcou continua lá.
 */
export async function disputeAttendance(
  id: string,
): Promise<ApiResult<AttendanceRecord>> {
  if (isLiveMode) {
    return request<AttendanceRecord>(
      `/v1/attendance/${encodeURIComponent(id)}/dispute`,
      { method: "POST" },
    );
  }

  const workerId = await getCurrentWorkerId();
  return withMock(() => {
    const record = store.attendanceRecords.find((item) => item.id === id);
    if (!record) return err("attendance_not_found", "Registro não encontrado.");
    if (record.workerId !== workerId) {
      return err("forbidden", "Este registro é de outra pessoa.");
    }
    if (isUnderDispute(record)) {
      return err("already_disputed", "Este registro já está em contestação.");
    }
    if (record.markedAt === null) {
      return err(
        "attendance_not_marked",
        "Este registro ainda não foi marcado.",
      );
    }

    const deadline = new Date(record.markedAt);
    deadline.setUTCDate(deadline.getUTCDate() + DISPUTE_WINDOW_DAYS);
    if (new Date() > deadline) {
      return err(
        "dispute_window_closed",
        `O prazo de ${DISPUTE_WINDOW_DAYS} dias para contestar já passou.`,
      );
    }

    // A marcação original sobrevive: `status` não muda. O que muda é a
    // dimensão de contestação, e é ela que tira o registro da conta pública.
    const updated: AttendanceRecord = { ...record, disputedAt: nowIso() };
    store.attendanceRecords = store.attendanceRecords.map((item) =>
      item.id === id ? updated : item,
    );
    return ok(updated);
  });
}
