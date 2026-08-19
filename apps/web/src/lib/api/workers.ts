import type { ApiResult } from "@extra/shared/types/api";
import type { Worker } from "@extra/shared/types/worker";
import {
  workerProfileUpdateSchema,
  workerStep1IdentitySchema,
  type WorkerProfileUpdate,
  type WorkerStep1Identity,
} from "@extra/shared/schemas/worker";
import { CITY } from "@extra/shared/constants/city";
import { getCurrentWorkerId, nowIso, randomId, store, withMock } from "./mock";
import { err, ok } from "./result";

export async function getMyWorkerProfile(): Promise<ApiResult<Worker | null>> {
  const workerId = await getCurrentWorkerId();
  return withMock(() =>
    ok(store.workers.find((worker) => worker.id === workerId) ?? null),
  );
}

/**
 * POST /v1/workers — etapa 1 do cadastro. O bloqueio de menores de 18 anos
 * mora no schema compartilhado (§14.2), então vale aqui e na rota real.
 */
export async function createWorker(
  input: WorkerStep1Identity,
): Promise<ApiResult<Worker>> {
  return withMock(() => {
    const parsed = workerStep1IdentitySchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return err("validation_error", issue.message, issue.path.join("."));
    }

    if (store.workers.some((worker) => worker.cpf === parsed.data.cpf)) {
      return err("cpf_already_registered", "Este CPF já tem cadastro.", "cpf");
    }

    const worker: Worker = {
      id: randomId(),
      fullName: parsed.data.fullName,
      phone: "",
      phoneVerifiedAt: null,
      cpf: parsed.data.cpf,
      birthDate: parsed.data.birthDate,
      city: CITY,
      neighborhood: "",
      roles: [],
      experience: "",
      availability: [],
      documentSelfieKey: null,
      introVideoKey: null,
      references: [],
      status: "incomplete",
      attendance: { present: 0, absent: 0, distinctCompanies: 0 },
      createdAt: nowIso(),
    };

    store.workers = [...store.workers, worker];
    return ok(worker);
  });
}

/**
 * PATCH /v1/workers/me — o cadastro salva etapa a etapa, então a atualização é
 * parcial: queda de conexão não pode zerar o esforço (§16.1).
 * `status` vira "complete" sozinho quando as 6 etapas estiverem preenchidas.
 */
export async function updateMyWorkerProfile(
  input: WorkerProfileUpdate,
): Promise<ApiResult<Worker>> {
  const workerId = await getCurrentWorkerId();
  return withMock(() => {
    const parsed = workerProfileUpdateSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return err("validation_error", issue.message, issue.path.join("."));
    }

    const current = store.workers.find((worker) => worker.id === workerId);
    if (!current) return err("worker_not_found", "Cadastro não encontrado.");

    const merged: Worker = { ...current, ...parsed.data };
    const complete =
      merged.phone !== "" &&
      merged.documentSelfieKey !== null &&
      merged.roles.length > 0 &&
      merged.availability.length > 0 &&
      merged.neighborhood !== "" &&
      merged.introVideoKey !== null &&
      merged.references.length === 2;

    // Só o próprio usuário desativa a conta: quem já se desativou não volta a
    // "complete" por um PATCH de perfil (CLAUDE.md, regra 3).
    const updated: Worker = {
      ...merged,
      status:
        current.status === "self_deactivated"
          ? "self_deactivated"
          : complete
            ? "complete"
            : "incomplete",
    };

    store.workers = store.workers.map((worker) =>
      worker.id === updated.id ? updated : worker,
    );
    return ok(updated);
  });
}

/** O próprio usuário desativa a conta. Não existe desativação por terceiro. */
export async function deactivateMyAccount(): Promise<ApiResult<Worker>> {
  const workerId = await getCurrentWorkerId();
  return withMock(() => {
    const current = store.workers.find((worker) => worker.id === workerId);
    if (!current) return err("worker_not_found", "Cadastro não encontrado.");

    const updated: Worker = { ...current, status: "self_deactivated" };
    store.workers = store.workers.map((worker) =>
      worker.id === updated.id ? updated : worker,
    );
    return ok(updated);
  });
}
