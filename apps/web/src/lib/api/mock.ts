import type { ApiResult } from "@extra/shared/types/api";
import type { Worker, WorkerPublicProfile } from "@extra/shared/types/worker";
import {
  applications,
  attendanceRecords,
  companies,
  jobPostContacts,
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
  jobPostContacts: [...jobPostContacts],
  applications: [...applications],
  attendanceRecords: [...attendanceRecords],
};

// Sem autenticação nesta fase: o mock assume um trabalhador fixo como
// "logado" (§11 resolve isso de verdade depois).
export const CURRENT_WORKER_ID = workers[0].id;

const DEFAULT_COMPANY_ID = companies[0].id;

/**
 * Cookie do seletor "entrar como" da área da empresa — só existe em modo
 * mock. Não é HttpOnly de propósito: o seletor (client component) precisa
 * escrever nele direto, sem round-trip de servidor.
 */
export const DEMO_COMPANY_COOKIE = "extra_demo_company";

/**
 * Lê o cookie nos dois mundos: em Server Component/Route Handler via
 * next/headers; em Client Component via document.cookie. As duas pontas
 * existem porque createCompany já é chamado de formulário client-side hoje
 * (company-registration-form.tsx), e as escritas da área da empresa
 * (publicar vaga, marcar presença) devem seguir o mesmo padrão.
 */
async function readDemoCompanyCookie(): Promise<string | null> {
  if (typeof window === "undefined") {
    try {
      const { cookies } = await import("next/headers");
      return (await cookies()).get(DEMO_COMPANY_COOKIE)?.value ?? null;
    } catch {
      // Fora de uma requisição de verdade (ex.: api.test.ts rodando via tsx,
      // fora do Next) next/headers não tem contexto para ler. Sem cookie é o
      // mesmo que ninguém ter escolhido — cai na empresa padrão abaixo.
      return null;
    }
  }
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${DEMO_COMPANY_COOKIE}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Empresa "logada" no momento. Fora do modo mock sempre volta a padrão — o
 * seletor de demonstração não existe em modo live (§11 resolve a sessão de
 * verdade depois).
 */
export async function getCurrentCompanyId(): Promise<string> {
  if (!isMockMode) return DEFAULT_COMPANY_ID;

  const chosen = await readDemoCompanyCookie();
  const isValid = chosen && store.companies.some((c) => c.id === chosen);
  return isValid ? chosen : DEFAULT_COMPANY_ID;
}

/**
 * Opções do seletor "entrar como". Não é um endpoint real — uma empresa
 * nunca deveria conseguir listar outras empresas — por isso fica aqui, fora
 * de lib/api/companies.ts, que espelha o contrato HTTP de verdade (§8.1).
 */
export function getDemoCompanyOptions(): { id: string; tradeName: string }[] {
  return store.companies.map((c) => ({ id: c.id, tradeName: c.tradeName }));
}

export const nowIso = () => new Date().toISOString();

export const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `mock-${Math.random().toString(16).slice(2)}-${Date.now()}`;

// Sem 0/O/1/I: ambíguos demais para copiar de uma mensagem de WhatsApp.
const SHORT_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Código de 4 caracteres que casa a conversa do WhatsApp com a candidatura (§16.5). */
export function randomShortCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += SHORT_CODE_CHARS[Math.floor(Math.random() * SHORT_CODE_CHARS.length)];
  }
  return code;
}

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
