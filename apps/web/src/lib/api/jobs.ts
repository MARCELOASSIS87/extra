import type { ApiResult, Paginated } from "@extra/shared/types/api";
import type {
  JobFilters,
  JobPost,
  JobReach,
  JobRole,
  PublicJobPost,
} from "@extra/shared/types/job";
import {
  jobPostSchema,
  type JobPostFormInput,
} from "@extra/shared/schemas/job";
import { saoPauloDate } from "@extra/shared/lib/datetime";
import { maxApplicationsFor } from "@extra/shared/lib/job";
import {
  cityDistanceKm,
  cityName,
  citySlug as citySlugOf,
  DEFAULT_CITY_ID,
} from "./cities";
import { getSessionRole } from "./session";
import {
  getCurrentCompanyId,
  getCurrentWorkerId,
  nowIso,
  randomId,
  store,
  withMock,
} from "./mock";
import { isLiveMode, request } from "./http";
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

/**
 * As rotas públicas de leitura devolvem `PublicJobPost`: a vaga mais os nomes
 * que a API resolve por join (§8). O mock faz o mesmo join na mão, contra as
 * mesmas coleções — sem isto a Fase 4 deixaria de ser troca de implementação,
 * porque o front receberia da API um campo que o mock nunca teve.
 */
export const toPublicJobPost = (job: JobPost): PublicJobPost => ({
  ...job,
  companyName:
    store.companies.find((company) => company.id === job.companyId)
      ?.tradeName ?? "",
  cityName: cityName(job.cityId),
  citySlug: citySlugOf(job.cityId),
});

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
): Promise<ApiResult<Paginated<PublicJobPost>>> {
  if (isLiveMode) {
    const { role, cityIds, neighborhood, date } = filters;

    // A rota recebe UMA cidade, por slug (`?city=`), enquanto o filtro da tela
    // é multi-cidade. Enquanto a rota não aceitar várias, mandamos a primeira
    // e o resto do recorte fica sem efeito — melhor uma lista mais larga que
    // uma lista vazia, que faz a pessoa concluir que não há vaga na cidade.
    // TODO: `?city=a,b,c` na rota, e este ramo manda `cityIds.join(",")`.
    const city =
      cityIds && cityIds.length > 0 ? citySlugOf(cityIds[0]) : undefined;

    // O dia do calendário em São Paulo vira o par de instantes em UTC que a
    // rota entende: ela não converte fuso (§17), quem converte é o front.
    const from = date ? new Date(`${date}T00:00:00-03:00`).toISOString() : undefined;
    const to = date ? new Date(`${date}T23:59:59-03:00`).toISOString() : undefined;

    const result = await request<Paginated<PublicJobPost>>("/v1/jobs", {
      query: { city, role, from, to, page: filters.page },
    });

    // `neighborhood` não existe na rota: filtra na página recebida, como a
    // tela já esperava. Some quando a rota aceitar o parâmetro.
    if (!result.ok || !neighborhood) return result;
    return ok({
      ...result.data,
      items: result.data.items.filter(
        (job) => job.neighborhood === neighborhood,
      ),
    });
  }

  return withMock(() => {
    const { role, cityIds, neighborhood, date } = filters;
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE);

    const matches = store.jobPosts
      .filter((job) => job.status === "open")
      .filter((job) => (role ? job.role === role : true))
      .filter((job) =>
        cityIds && cityIds.length > 0 ? cityIds.includes(job.cityId) : true,
      )
      .filter((job) =>
        neighborhood ? job.neighborhood === neighborhood : true,
      )
      // O filtro é por dia do calendário em Poços: quem procura "sábado"
      // quer a formatura que começa 22h de sábado, não o instante UTC.
      .filter((job) => (date ? saoPauloDate(job.startsAt) === date : true))
      .sort(byHighlightThenRecent);

    const start = (page - 1) * pageSize;

    return ok({
      items: matches.slice(start, start + pageSize).map(toPublicJobPost),
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
 * TODO: `nearbyRadiusKm` de propósito não entra aqui. O raio governa o
 * AVISO (§16.2); a listagem é navegação, e o que ela abre é o que a pessoa
 * assinou na mão. Some as cidades do raio aqui se a lista inicial ficar curta
 * demais na prática.
 */
export async function listJobsForMe(
  pageSize = WORKER_HOME_PAGE_SIZE,
): Promise<ApiResult<Paginated<PublicJobPost>>> {
  if (isLiveMode) {
    // A rota devolve a página inteira do servidor; a home mostra só uma
    // prévia, então o corte de `pageSize` continua sendo do cliente.
    const result = await request<Paginated<PublicJobPost>>("/v1/me/jobs");
    if (!result.ok) return result;
    return ok({ ...result.data, items: result.data.items.slice(0, pageSize) });
  }

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
      items: matches.slice(0, pageSize).map(toPublicJobPost),
      total: matches.length,
      page: 1,
      pageSize,
    });
  });
}

/**
 * Em que cidades a listagem abre quando a URL não pede nenhuma: as que o
 * trabalhador assinou (§16.2, item 5). Visitante anônimo cai na cidade
 * âncora — abrir mostrando o país inteiro é o mesmo que não filtrar.
 *
 * Fora do `withMock` de propósito, igual a `getSessionRole()`: é leitura
 * local de sessão, e 300–800ms aqui atrasariam a busca inteira.
 */
export async function getDefaultJobCityIds(): Promise<string[]> {
  if ((await getSessionRole()) !== "worker") return [DEFAULT_CITY_ID];

  // Em live sai do próprio perfil, que a rota `/v1/workers/me` devolve. Sem
  // ApiResult na assinatura (é leitura de sessão, §8.1): falha vira o padrão,
  // e a busca abre na cidade âncora em vez de não abrir.
  if (isLiveMode) {
    const me = await request<{ notificationCityIds: string[] }>(
      "/v1/workers/me",
    );
    const subscribed = me.ok ? me.data.notificationCityIds : [];
    return subscribed.length > 0 ? subscribed : [DEFAULT_CITY_ID];
  }

  const workerId = await getCurrentWorkerId();
  const worker = store.workers.find((item) => item.id === workerId);
  const subscribed = worker?.notificationCityIds ?? [];
  return subscribed.length > 0 ? subscribed : [DEFAULT_CITY_ID];
}

/**
 * Quantos trabalhadores seriam avisados de uma vaga com aquele alcance — o
 * "só Poços: 34 garçons; até 50 km: 121" que a publicação mostra ANTES de
 * estreitar (§16.2). Sem esse número a empresa decide no escuro e o prejuízo
 * fica invisível para os dois lados.
 *
 * As duas regras que tornam o filtro da empresa seguro estão aqui:
 * inscrição explícita na cidade da vaga SEMPRE passa (a pessoa declarou que
 * trabalha ali, pode morar a 80 km e ir de ônibus), e o `reach` filtra apenas
 * quem está chegando pelo raio de vizinhança.
 *
 * TODO: não filtra disponibilidade de dia e período. O número é apoio de
 * decisão, e recalcular a cada tecla na data faria ele piscar; o disparo real
 * reavalia. Entra aqui quando o push existir.
 */
export async function countReachedWorkers(input: {
  cityId: string;
  role: JobRole;
  reach: JobReach;
  reachRadiusKm: number | null;
  /**
   * Início da vaga. Opcional porque a tela pergunta o alcance ANTES de a data
   * estar preenchida; sem ele o servidor conta sem o recorte de dia e período,
   * e o número sai maior que o do push. Quem já tem a data manda.
   */
  startsAt?: string;
}): Promise<number> {
  const { cityId, role, reach, reachRadiusKm, startsAt } = input;

  if (isLiveMode) {
    const result = await request<{ count: number }>("/v1/jobs/reach-count", {
      query: {
        cityId,
        role,
        reach,
        reachRadiusKm: reachRadiusKm ?? undefined,
        startsAt,
      },
    });
    // Sem ApiResult na assinatura: falha vira 0, e a tela mostra o mesmo que
    // mostra enquanto o número não chegou, em vez de quebrar a publicação.
    return result.ok ? result.data.count : 0;
  }

  return store.workers.filter((worker) => {
    if (worker.status !== "complete") return false;
    if (!worker.roles.includes(role)) return false;

    if (worker.notificationCityIds.includes(cityId)) return true;

    // Chegando pelo raio de vizinhança: só aqui o alcance da empresa filtra.
    if (worker.nearbyRadiusKm === null) return false;
    const distance = cityDistanceKm(worker.cityId, cityId);
    if (distance === null || distance > worker.nearbyRadiusKm) return false;

    switch (reach) {
      case "unrestricted":
        return true;
      case "city_only":
        return worker.cityId === cityId;
      case "nearby":
        return reachRadiusKm !== null && distance <= reachRadiusKm;
    }
  }).length;
}

/**
 * O slug é único DENTRO da cidade, nunca no país — duas cidades podem ter uma
 * `garcom-formatura`. Por isso a busca leva as duas partes, iguais às duas da
 * URL (§8.1), e não o slug sozinho.
 */
export async function getJobBySlug(
  citySlug: string,
  slug: string,
): Promise<ApiResult<PublicJobPost | null>> {
  if (isLiveMode) {
    const result = await request<PublicJobPost>(
      `/v1/jobs/${encodeURIComponent(citySlug)}/${encodeURIComponent(slug)}`,
    );
    // Vaga inexistente é `null`, não erro: a página desenha "não encontrada".
    if (!result.ok && result.error.code === "job_not_found") return ok(null);
    return result;
  }

  return withMock(() => {
    const job = store.jobPosts.find(
      (item) => item.slug === slug && citySlug === citySlugOf(item.cityId),
    );
    return ok(job ? toPublicJobPost(job) : null);
  });
}

/**
 * Bairros que têm vaga aberta agora, em ordem alfabética. O filtro só oferece
 * o que leva a algum resultado — bairro sem vaga vira beco sem saída.
 */
export async function listOpenJobNeighborhoods(): Promise<ApiResult<string[]>> {
  if (isLiveMode) {
    return request<string[]>("/v1/jobs/neighborhoods");
  }

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
): Promise<ApiResult<PublicJobPost>> {
  if (isLiveMode) {
    // O mesmo schema do formulário, incluindo o filtro de linguagem
    // discriminatória do §14.1 — que a rota reaplica, porque o cliente é
    // contornável.
    const parsed = jobPostSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return err("validation_error", issue.message, issue.path.join("."));
    }
    return request<PublicJobPost>("/v1/jobs", {
      method: "POST",
      body: parsed.data,
    });
  }

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
      // A cidade vem do FORMULÁRIO: é onde o trabalho acontece, e é ela que
      // decide quem recebe o aviso (§16.2). A da empresa é só o padrão.
      cityId: data.cityId,
      applicationsCount: 0,
      maxApplications: maxApplicationsFor(data.vacancies),
      status: "open",
      isHighlighted: false,
      publishedAt: nowIso(),
      // O anúncio deixa de valer quando o bico acaba — com instante, isso
      // é o próprio `endsAt`, e não erra mais o dia na virada da noite.
      expiresAt: data.endsAt,
    };

    store.jobPosts = [job, ...store.jobPosts];
    return ok(toPublicJobPost(job));
  });
}

/** PATCH /v1/jobs/:id/close — a empresa fecha a vaga quando já se acertou. */
export async function closeJob(id: string): Promise<ApiResult<PublicJobPost>> {
  if (isLiveMode) {
    return request<PublicJobPost>(`/v1/jobs/${encodeURIComponent(id)}/close`, {
      method: "PATCH",
    });
  }

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
    return ok(toPublicJobPost(updated));
  });
}
