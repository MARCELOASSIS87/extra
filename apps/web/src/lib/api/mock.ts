import type { ApiResult } from "@extra/shared/types/api";
import type { Worker, WorkerPublicProfile } from "@extra/shared/types/worker";
import {
  applications,
  attendanceRecords,
  companies,
  jobPosts,
  workers,
} from "@/mocks/fixtures";
import { err } from "./result";

// Único arquivo autorizado a enxergar src/mocks/ (regra de ouro do outside-in).
// Quando a Fase 4 chegar, as funções de lib/api/ trocam withMock() por fetch e
// nada mais muda — as assinaturas públicas já são as definitivas.

const API_MODE = process.env.NEXT_PUBLIC_API_MODE ?? "mock";
export const isMockMode = API_MODE === "mock";

const MIN_LATENCY_MS = 300;
const MAX_LATENCY_MS = 800;
const FAILURE_RATE = 0.05;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executa uma operação do mock com a latência e a taxa de falha de rede real.
 * Os ~5% de erro existem para os estados de carregamento e erro nascerem junto
 * com a tela, em vez de virarem dívida (§8.1).
 */
export async function withMock<T>(
  produce: () => ApiResult<T>,
): Promise<ApiResult<T>> {
  if (!isMockMode) {
    return err(
      "api_mode_unavailable",
      "A API real ainda não está implementada. Rode com NEXT_PUBLIC_API_MODE=mock.",
    );
  }

  await sleep(
    MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS),
  );

  if (Math.random() < FAILURE_RATE) {
    return err("network_error", "Não foi possível concluir. Tente de novo.");
  }

  return produce();
}

// Estado mutável em memória: candidatar-se a uma vaga precisa aparecer na tela
// de candidaturas logo depois. ponytail: reinicia a cada reload e não é
// compartilhado entre servidor e cliente — suficiente enquanto for mock.
export const store = {
  companies: [...companies],
  workers: [...workers],
  jobPosts: [...jobPosts],
  applications: [...applications],
  attendanceRecords: [...attendanceRecords],
};

// Sem autenticação nesta fase: o mock assume um trabalhador e uma empresa
// fixos como "logados" (§11 resolve isso de verdade depois).
export const CURRENT_WORKER_ID = workers[0].id;
export const CURRENT_COMPANY_ID = companies[0].id;

export const nowIso = () => new Date().toISOString();

export const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `mock-${Math.random().toString(16).slice(2)}-${Date.now()}`;

/**
 * Projeção que a empresa enxerga: sem CPF e sem data de nascimento.
 * No mundo real quem faz esse corte é o servidor; aqui o mock precisa imitar
 * para nenhuma tela se acostumar a receber dado sensível.
 */
export function toPublicProfile(worker: Worker): WorkerPublicProfile {
  const [firstName, ...rest] = worker.fullName.split(" ");
  const lastName = rest.at(-1) ?? "";

  return {
    id: worker.id,
    firstName,
    lastNameInitial: lastName ? `${lastName.charAt(0)}.` : "",
    neighborhood: worker.neighborhood,
    roles: worker.roles,
    experience: worker.experience,
    introVideoUrl: worker.introVideoKey
      ? `/mock-media/${worker.introVideoKey}`
      : null,
    hasCompleteProfile: worker.status === "complete",
    attendance: worker.attendance,
    memberSince: worker.createdAt,
  };
}
