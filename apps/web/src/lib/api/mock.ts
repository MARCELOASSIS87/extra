import type { ApiResult } from "@extra/shared/types/api";
import type { AttendanceSummary } from "@extra/shared/types/attendance";
import type {
  Worker,
  WorkerApplicantProfile,
  WorkerPublicProfile,
} from "@extra/shared/types/worker";
import { companies, workers } from "@/mocks/fixtures";
import { cityName } from "./cities";
import { resetStore, store } from "@/mocks/store";
import { err } from "./result";

// O estado mutável mora em src/mocks/store.ts (fixtures + localStorage).
// Reexportado aqui porque lib/api/ é a única porta para os dados — nenhum
// componente importa de src/mocks/ direto (regra de ouro do outside-in).
export { store };

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

/**
 * Volta o estado da demonstração para as fixtures, apagando o localStorage
 * (/demo/reset). Fica aqui, e não em src/mocks/, porque a tela que chama é um
 * componente — e componente só enxerga lib/api/.
 */
export function resetMockState(): void {
  resetStore();
}

const DEFAULT_COMPANY_ID = companies[0].id;
const DEFAULT_WORKER_ID = workers[0].id;

/**
 * Cookies do seletor "entrar como" da barra de demonstração — só existem em
 * modo mock. Não são HttpOnly de propósito: o seletor (client component)
 * precisa escrever neles direto, sem round-trip de servidor.
 */
export const DEMO_COMPANY_COOKIE = "extra_demo_company";
export const DEMO_WORKER_COOKIE = "extra_demo_worker";
export const DEMO_ROLE_COOKIE = "extra_demo_role";

/**
 * Lê um cookie nos dois mundos: em Server Component/Route Handler via
 * next/headers; em Client Component via document.cookie. As duas pontas
 * existem porque createCompany já é chamado de formulário client-side hoje
 * (company-registration-form.tsx), e as escritas da área da empresa
 * (publicar vaga, marcar presença) devem seguir o mesmo padrão.
 *
 * O `import()` de next/headers é dinâmico de propósito: estático, ele entra
 * no bundle do navegador e o Next recusa o módulo inteiro em qualquer
 * Client Component que chegue até aqui.
 */
export async function readCookie(cookieName: string): Promise<string | null> {
  if (typeof window === "undefined") {
    try {
      const { cookies } = await import("next/headers");
      return (await cookies()).get(cookieName)?.value ?? null;
    } catch {
      // Fora de uma requisição de verdade (ex.: api.test.ts rodando via tsx,
      // fora do Next) next/headers não tem contexto para ler. Sem cookie é o
      // mesmo que ninguém ter escolhido — cai no padrão abaixo.
      return null;
    }
  }
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${cookieName}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Empresa "logada" no momento. Fora do modo mock sempre volta a padrão — a
 * barra de demonstração não existe em modo live (§11 resolve a sessão de
 * verdade depois).
 */
export async function getCurrentCompanyId(): Promise<string> {
  if (!isMockMode) return DEFAULT_COMPANY_ID;

  const chosen = await readCookie(DEMO_COMPANY_COOKIE);
  const isValid = chosen && store.companies.some((c) => c.id === chosen);
  return isValid ? chosen : DEFAULT_COMPANY_ID;
}

/**
 * Trabalhador "logado" no momento. Mesma regra da empresa: fora do modo mock
 * sempre volta ao padrão.
 */
export async function getCurrentWorkerId(): Promise<string> {
  if (!isMockMode) return DEFAULT_WORKER_ID;

  const chosen = await readCookie(DEMO_WORKER_COOKIE);
  const isValid = chosen && store.workers.some((w) => w.id === chosen);
  return isValid ? chosen : DEFAULT_WORKER_ID;
}

/**
 * Opções dos seletores "entrar como" da barra de demonstração. Não são
 * endpoints reais — uma empresa nunca deveria conseguir listar outras
 * empresas, nem um trabalhador listar outros trabalhadores — por isso ficam
 * aqui, fora de lib/api/companies.ts e lib/api/workers.ts, que espelham o
 * contrato HTTP de verdade (§8.1).
 */
export function getDemoCompanyOptions(): { id: string; tradeName: string }[] {
  return store.companies.map((c) => ({ id: c.id, tradeName: c.tradeName }));
}

export function getDemoWorkerOptions(): { id: string; fullName: string }[] {
  return store.workers.map((w) => ({ id: w.id, fullName: w.fullName }));
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
    code +=
      SHORT_CODE_CHARS[Math.floor(Math.random() * SHORT_CODE_CHARS.length)];
  }
  return code;
}

/**
 * Agregado público de presença: contestado e vencido (>12 meses) não contam
 * (§16.4, §16.7) — computado na hora a partir de `attendanceRecords`, não de
 * um contador guardado, para nunca ficar defasado de uma contestação ou de um
 * registro que passou da validade.
 */
function computeAttendanceSummary(workerId: string): AttendanceSummary {
  const now = nowIso();
  const countable = store.attendanceRecords.filter(
    (record) =>
      record.workerId === workerId &&
      (record.status === "present" || record.status === "absent") &&
      record.expiresAt > now,
  );

  return {
    present: countable.filter((record) => record.status === "present").length,
    absent: countable.filter((record) => record.status === "absent").length,
    distinctCompanies: new Set(countable.map((record) => record.companyId))
      .size,
  };
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
    cityName: cityName(worker.cityId),
    neighborhood: worker.neighborhood,
    roles: worker.roles,
    experience: worker.experience,
    introVideoUrl: worker.introVideoKey
      ? `/mock-media/${worker.introVideoKey}`
      : null,
    // ponytail: poster por convenção de nome ao lado do vídeo, em vez de mais
    // uma chave no Worker. Vira campo próprio quando o upload real gerar a
    // miniatura com outro nome.
    introVideoPosterUrl: worker.introVideoKey
      ? `/mock-media/${worker.introVideoKey.replace(/\.\w+$/, ".jpg")}`
      : null,
    // O selo é o vídeo (§16.1), não a conclusão do cadastro.
    hasCompleteProfile: worker.profileCompletedAt !== null,
    attendance: computeAttendanceSummary(worker.id),
    memberSince: worker.createdAt,
  };
}

/**
 * Projeção que a empresa daquela vaga enxerga do candidato dela (§16.5):
 * a pública mais nome completo, disponibilidade e referências. Continua sem
 * CPF e sem data de nascimento — quem faz esse corte no mundo real é o
 * servidor, e o mock imita para nenhuma tela se acostumar a receber dado
 * sensível.
 */
export function toApplicantProfile(worker: Worker): WorkerApplicantProfile {
  return {
    ...toPublicProfile(worker),
    fullName: worker.fullName,
    availability: worker.availability,
  };
}
