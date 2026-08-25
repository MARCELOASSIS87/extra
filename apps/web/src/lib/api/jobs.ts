import type { ApiResult, Paginated } from "@extra/shared/types/api";
import type { JobFilters, JobPost } from "@extra/shared/types/job";
import {
  jobPostSchema,
  type JobPostFormInput,
} from "@extra/shared/schemas/job";
import { saoPauloDate } from "@extra/shared/lib/datetime";
import {
  getCurrentCompanyId,
  getCurrentWorkerId,
  nowIso,
  randomId,
  store,
  withMock,
} from "./mock";
import { err, ok } from "./result";

const DEFAULT_PAGE_SIZE = 20;

/** A home do trabalhador mostra só uma prévia; a lista completa fica em /vagas. */
const WORKER_HOME_PAGE_SIZE = 6;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Destaque primeiro, depois a publicada há menos tempo. */
const byHighlightThenRecent = (a: JobPost, b: JobPost) => {
  if (a.isHighlighted !== b.isHighlighted) return a.isHighlighted ? -1 : 1;
  return b.publishedAt.localeCompare(a.publishedAt);
};

/**
 * Listagem pública: só vaga aberta. Destaque primeiro, depois a publicada há
 * menos tempo — vaga nova é o que traz o trabalhador de volta ao app.
 */
export async function listJobs(
  filters: JobFilters = {},
): Promise<ApiResult<Paginated<JobPost>>> {
  return withMock(() => {
    const { role, cityId, neighborhood, date } = filters;
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE);

    const matches = store.jobPosts
      .filter((job) => job.status === "open")
      .filter((job) => (role ? job.role === role : true))
      .filter((job) => (cityId ? job.cityId === cityId : true))
      .filter((job) =>
        neighborhood ? job.neighborhood === neighborhood : true,
      )
      // O filtro é por dia do calendário em Poços: quem procura "sábado"
      // quer a formatura que começa 22h de sábado, não o instante UTC.
      .filter((job) => (date ? saoPauloDate(job.startsAt) === date : true))
      .sort(byHighlightThenRecent);

    const start = (page - 1) * pageSize;

    return ok({
      items: matches.slice(start, start + pageSize),
      total: matches.length,
      page,
      pageSize,
    });
  });
}

/**
 * "Vagas para você" da home do trabalhador: o roteamento do §16.2 aplicado à
 * listagem — só as funções e as cidades que ele assinou. Quem ainda não
 * escolheu função vê todas as abertas dessas cidades, em vez de tela vazia.
 *
 * O opt-in do trabalhador é o teto: quem mora numa vizinha e assinou Poços vê
 * as vagas de Poços; quem não assinou não vê, por mais perto que seja.
 *
 * ponytail: `nearbyRadiusKm` ainda não entra aqui — a tela que o coleta é a
 * S4. Quando entrar, soma as cidades do raio às assinadas.
 */
export async function listJobsForMe(
  pageSize = WORKER_HOME_PAGE_SIZE,
): Promise<ApiResult<Paginated<JobPost>>> {
  const workerId = await getCurrentWorkerId();
  return withMock(() => {
    const worker = store.workers.find((item) => item.id === workerId);
    if (!worker) return err("worker_not_found", "Cadastro não encontrado.");

    const matches = store.jobPosts
      .filter((job) => job.status === "open")
      .filter((job) => worker.notificationCityIds.includes(job.cityId))
      .filter(
        (job) => worker.roles.length === 0 || worker.roles.includes(job.role),
      )
      .sort(byHighlightThenRecent);

    return ok({
      items: matches.slice(0, pageSize),
      total: matches.length,
      page: 1,
      pageSize,
    });
  });
}

export async function getJobBySlug(
  slug: string,
): Promise<ApiResult<JobPost | null>> {
  return withMock(() =>
    ok(store.jobPosts.find((job) => job.slug === slug) ?? null),
  );
}

/**
 * Bairros que têm vaga aberta agora, em ordem alfabética. O filtro só oferece
 * o que leva a algum resultado — bairro sem vaga vira beco sem saída.
 */
export async function listOpenJobNeighborhoods(): Promise<ApiResult<string[]>> {
  return withMock(() => {
    const neighborhoods = new Set(
      store.jobPosts
        .filter((job) => job.status === "open")
        .map((job) => job.neighborhood),
    );
    return ok([...neighborhoods].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });
}

/**
 * O mesmo schema que valida o formulário valida aqui — inclusive o filtro de
 * linguagem discriminatória do §14.1, que o cliente sozinho contornaria.
 */
export async function createJob(
  input: JobPostFormInput,
): Promise<ApiResult<JobPost>> {
  const companyId = await getCurrentCompanyId();
  return withMock(() => {
    const parsed = jobPostSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return err("validation_error", issue.message, issue.path.join("."));
    }

    const company = store.companies.find((item) => item.id === companyId);
    if (!company) {
      return err("company_not_found", "Empresa não encontrada.");
    }

    const data = parsed.data;
    const job: JobPost = {
      ...data,
      id: randomId(),
      slug: `${slugify(data.title)}-${randomId().slice(0, 6)}`,
      companyId: company.id,
      cityId: company.cityId,
      applicationsCount: 0,
      maxApplications: data.vacancies * 3,
      status: "open",
      isHighlighted: false,
      publishedAt: nowIso(),
      // O anúncio deixa de valer quando o bico acaba — com instante, isso
      // é o próprio `endsAt`, e não erra mais o dia na virada da noite.
      expiresAt: data.endsAt,
    };

    store.jobPosts = [job, ...store.jobPosts];
    return ok(job);
  });
}

/** PATCH /v1/jobs/:id/close — a empresa fecha a vaga quando já se acertou. */
export async function closeJob(id: string): Promise<ApiResult<JobPost>> {
  const companyId = await getCurrentCompanyId();
  return withMock(() => {
    const job = store.jobPosts.find((item) => item.id === id);
    if (!job) return err("job_not_found", "Vaga não encontrada.");
    if (job.companyId !== companyId) {
      return err("forbidden", "Esta vaga é de outra empresa.");
    }
    if (job.status !== "open") {
      return err("job_not_open", "Esta vaga não está aberta.");
    }

    const updated: JobPost = { ...job, status: "filled" };
    store.jobPosts = store.jobPosts.map((item) =>
      item.id === id ? updated : item,
    );
    return ok(updated);
  });
}
