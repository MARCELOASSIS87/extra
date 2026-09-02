import type { ApiResult } from "@extra/shared/types/api";
import type { Worker } from "@extra/shared/types/worker";
import {
  workerProfileUpdateSchema,
  workerQuickRegistrationSchema,
  workerStep1IdentitySchema,
  workerTermsAcceptanceSchema,
  type WorkerProfileUpdate,
  type WorkerQuickRegistrationInput,
  type WorkerStep1Identity,
  type WorkerTermsAcceptance,
} from "@extra/shared/schemas/worker";
import { DEFAULT_CITY_ID } from "./cities";
import { getCurrentWorkerId, nowIso, randomId, store, withMock } from "./mock";
import { isLiveMode, request } from "./http";
import { err, ok } from "./result";

/**
 * Data e IP do aceite quem carimba é o servidor — o cliente não sabe o próprio
 * IP e não deveria escolher a hora. No mock não há requisição para ler, então
 * fica o não-endereço.
 *
 * TODO: literal aqui, `request.ip` do Fastify na Fase 4.
 */
const MOCK_ACCEPTANCE_IP = "0.0.0.0";

export async function getMyWorkerProfile(): Promise<ApiResult<Worker | null>> {
  if (isLiveMode) {
    const result = await request<Worker>("/v1/workers/me");
    // Conta sem cadastro de trabalhador é o estado "ainda não se cadastrou",
    // não um erro para a tela desenhar.
    if (!result.ok && result.error.code === "forbidden") return ok(null);
    return result;
  }

  const workerId = await getCurrentWorkerId();
  return withMock(() =>
    ok(store.workers.find((worker) => worker.id === workerId) ?? null),
  );
}

/**
 * POST /v1/workers — etapa 1 do cadastro. O bloqueio de menores de 18 anos
 * mora no schema compartilhado (§14.2), então vale aqui e na rota real.
 *
 * O aceite do termo vem junto porque é ele que autoriza a existência do
 * cadastro: `termsVersion`, `termsAcceptedAt` e `termsAcceptedIp` não são
 * anuláveis. Na tela o aceite continua sendo etapa própria (§16.1) — o que
 * não pode é gravar a pessoa antes de ela consentir.
 */
export async function createWorker(
  input: WorkerStep1Identity & WorkerTermsAcceptance,
): Promise<ApiResult<Worker>> {
  // TODO: sem rota equivalente. `POST /v1/workers` exige o cadastro INTEIRO
  // (identidade + perfil + cidade + preferências de aviso, `workerCreateSchema`
  // é `.strict()`), enquanto esta função grava só a etapa 1 — o cadastro salva
  // etapa a etapa para queda de conexão não zerar o esforço (§16.1). Mandar a
  // etapa 1 sozinha para lá dá 400. Espera uma rota que aceite o parcial.
  if (isLiveMode) {
    return err(
      "not_implemented",
      "Este cadastro ainda não está disponível.",
    );
  }

  return withMock(() => {
    const parsed = workerStep1IdentitySchema
      .extend(workerTermsAcceptanceSchema.shape)
      .safeParse(input);
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
      cityId: DEFAULT_CITY_ID,
      neighborhood: "",
      // Nasce assinando a própria cidade e com o raio desligado: o padrão mais
      // aberto que não gasta a permissão de notificar. A escolha é da S4.
      notificationCityIds: [DEFAULT_CITY_ID],
      nearbyRadiusKm: null,
      roles: [],
      experience: "",
      availability: [],
      documentSelfieKey: null,
      introVideoKey: null,
      status: "incomplete",
      termsVersion: parsed.data.termsVersion,
      termsAcceptedAt: nowIso(),
      termsAcceptedIp: MOCK_ACCEPTANCE_IP,
      profileCompletedAt: null,
      attendance: {
        present: 0,
        absent: 0,
        distinctCompanies: 0,
        hasHistory: false,
      },
      createdAt: nowIso(),
    };

    store.workers = [...store.workers, worker];
    return ok(worker);
  });
}

/**
 * POST /v1/workers/quick — cadastro reduzido: nome, telefone, funções e
 * bairro. É o destino do muro do "Quero essa vaga"; as 6 etapas completas do
 * §16.1 (CPF, selfie, vídeo, referências) ficam para a tarefa 11. Sem CPF,
 * `status` não sai de "incomplete" por aqui.
 */
export async function createWorkerQuick(
  input: WorkerQuickRegistrationInput,
): Promise<ApiResult<Worker>> {
  // TODO: sem rota. Mesma razão de `createWorker`, mais uma: o cadastro
  // reduzido não tem CPF, e `workerCreateSchema` o exige.
  if (isLiveMode) {
    return err(
      "not_implemented",
      "Este cadastro ainda não está disponível.",
    );
  }

  return withMock(() => {
    const parsed = workerQuickRegistrationSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return err("validation_error", issue.message, issue.path.join("."));
    }

    if (store.workers.some((worker) => worker.phone === parsed.data.phone)) {
      return err(
        "phone_already_registered",
        "Este telefone já tem cadastro.",
        "phone",
      );
    }

    const worker: Worker = {
      id: randomId(),
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      phoneVerifiedAt: null,
      cpf: "",
      birthDate: parsed.data.birthDate,
      cityId: parsed.data.cityId,
      neighborhood: parsed.data.neighborhood,
      notificationCityIds: parsed.data.notificationCityIds,
      nearbyRadiusKm: parsed.data.nearbyRadiusKm,
      roles: parsed.data.roles,
      experience: "",
      availability: [],
      documentSelfieKey: null,
      introVideoKey: null,
      status: "incomplete",
      termsVersion: parsed.data.termsVersion,
      termsAcceptedAt: nowIso(),
      termsAcceptedIp: MOCK_ACCEPTANCE_IP,
      profileCompletedAt: null,
      attendance: {
        present: 0,
        absent: 0,
        distinctCompanies: 0,
        hasHistory: false,
      },
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
  if (isLiveMode) {
    const parsed = workerProfileUpdateSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return err("validation_error", issue.message, issue.path.join("."));
    }
    return request<Worker>("/v1/workers/me", {
      method: "PATCH",
      body: parsed.data,
    });
  }

  const workerId = await getCurrentWorkerId();
  return withMock(() => {
    const parsed = workerProfileUpdateSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return err("validation_error", issue.message, issue.path.join("."));
    }

    const current = store.workers.find((worker) => worker.id === workerId);
    if (!current) return err("worker_not_found", "Cadastro não encontrado.");

    // O aceite não vem do cliente pronto: ele diz "aceito a versão X", e o
    // servidor é quem carimba quando e de onde.
    const { termsAccepted, termsVersion, ...profile } = parsed.data;
    const merged: Worker = {
      ...current,
      ...profile,
      ...(termsAccepted && termsVersion
        ? {
            termsVersion,
            termsAcceptedAt: nowIso(),
            termsAcceptedIp: MOCK_ACCEPTANCE_IP,
          }
        : {}),
    };

    // Cadastro concluído: recebe vaga e se candidata. O vídeo NÃO entra —
    // quem não grava conclui do mesmo jeito (§16.1).
    const complete =
      merged.phone !== "" &&
      merged.documentSelfieKey !== null &&
      merged.roles.length > 0 &&
      merged.availability.length > 0 &&
      merged.neighborhood !== "";

    // Só o próprio usuário desativa a conta: quem já se desativou não volta a
    // "complete" por um PATCH de perfil (CLAUDE.md, regra 3).
    const status: Worker["status"] =
      current.status === "self_deactivated"
        ? "self_deactivated"
        : complete
          ? "complete"
          : "incomplete";

    // O selo é o vídeo. Uma vez ganho, não se recarimba a cada PATCH; some se
    // a pessoa apagar o vídeo ou o cadastro deixar de estar concluído.
    const earnedBadge = status === "complete" && merged.introVideoKey !== null;

    const updated: Worker = {
      ...merged,
      status,
      profileCompletedAt: earnedBadge
        ? (current.profileCompletedAt ?? nowIso())
        : null,
    };

    store.workers = store.workers.map((worker) =>
      worker.id === updated.id ? updated : worker,
    );
    return ok(updated);
  });
}

/** O próprio usuário desativa a conta. Não existe desativação por terceiro. */
export async function deactivateMyAccount(): Promise<ApiResult<Worker>> {
  // TODO: sem rota. `PATCH /v1/workers/me` não aceita `status` — e não deve
  // aceitar: desativar é ato do próprio dono, não um campo de perfil.
  // Espera `POST /v1/workers/me/deactivate`.
  if (isLiveMode) {
    return err(
      "not_implemented",
      "A desativação ainda não está disponível.",
    );
  }

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
