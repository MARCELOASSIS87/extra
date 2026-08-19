import type { ApiResult, Paginated } from "@extra/shared/types/api";
import type { JobFilters, JobPost, JobPostContact } from "@extra/shared/types/job";
import { jobPostSchema, type JobPostInput } from "@extra/shared/schemas/job";
import {
  CURRENT_WORKER_ID,
  getCurrentCompanyId,
  nowIso,
  randomId,
  store,
  withMock,
} from "./mock";
import { err, ok } from "./result";

const DEFAULT_PAGE_SIZE = 20;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Listagem pública: só vaga aberta. Destaque primeiro, depois a publicada há
 * menos tempo — vaga nova é o que traz o trabalhador de volta ao app.
 */
export async function listJobs(
  filters: JobFilters = {},
): Promise<ApiResult<Paginated<JobPost>>> {
  return withMock(() => {
    const { role, city, neighborhood, date } = filters;
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE);

    const matches = store.jobPosts
      .filter((job) => job.status === "open")
      .filter((job) => (role ? job.role === role : true))
      .filter((job) => (city ? job.city === city : true))
      .filter((job) =>
        neighborhood ? job.neighborhood === neighborhood : true,
      )
      .filter((job) => (date ? job.date === date : true))
      .sort((a, b) => {
        if (a.isHighlighted !== b.isHighlighted)
          return a.isHighlighted ? -1 : 1;
        return b.publishedAt.localeCompare(a.publishedAt);
      });

    const start = (page - 1) * pageSize;

    return ok({
      items: matches.slice(start, start + pageSize),
      total: matches.length,
      page,
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
  input: JobPostInput,
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

    const { contactPhone, ...data } = parsed.data;
    const jobId = randomId();
    const job: JobPost = {
      ...data,
      id: jobId,
      slug: `${slugify(data.title)}-${randomId().slice(0, 6)}`,
      companyId: company.id,
      city: company.city,
      applicationsCount: 0,
      maxApplications: data.vacancies * 3,
      status: "open",
      isHighlighted: false,
      publishedAt: nowIso(),
      expiresAt: `${data.date}T23:59:00.000Z`,
    };

    store.jobPosts = [job, ...store.jobPosts];
    store.jobPostContacts = [
      ...store.jobPostContacts,
      { jobPostId: jobId, contactPhone },
    ];
    return ok(job);
  });
}

/**
 * GET /v1/jobs/:id/contact — o telefone nunca sai no payload público (§16.5).
 * Só libera para quem tem candidatura ativa (não retirada) nesta vaga.
 */
export async function getJobContact(
  jobId: string,
): Promise<ApiResult<JobPostContact>> {
  return withMock(() => {
    const hasActiveApplication = store.applications.some(
      (item) =>
        item.jobPostId === jobId &&
        item.workerId === CURRENT_WORKER_ID &&
        item.status !== "withdrawn",
    );
    if (!hasActiveApplication) {
      return err("forbidden", "Candidate-se para ver o contato.");
    }

    const contact = store.jobPostContacts.find(
      (item) => item.jobPostId === jobId,
    );
    if (!contact) return err("job_not_found", "Vaga não encontrada.");

    return ok(contact);
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
