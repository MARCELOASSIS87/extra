import assert from "node:assert/strict";
import { hasActiveFilters, jobsHref } from "./job-search";
import { parseJobSearchParams } from "./job-search-params";

// --- leitura da query string ------------------------------------------------
assert.deepEqual(parseJobSearchParams({}), {});

assert.deepEqual(
  parseJobSearchParams({
    funcao: "garcom",
    cidade: "3151800",
    data: "2026-09-05",
    bairro: "Centro",
    pagina: "3",
  }),
  {
    role: "garcom",
    cityId: "3151800",
    date: "2026-09-05",
    neighborhood: "Centro",
    page: 3,
  },
);

// Cidade é id do IBGE, nunca texto: nome digitado na URL é filtro estragado.
assert.deepEqual(parseJobSearchParams({ cidade: "Poços de Caldas" }), {});

// Campo vazio de formulário GET é "sem filtro", não filtro por string vazia.
assert.deepEqual(parseJobSearchParams({ funcao: "", bairro: "  " }), {});

// Um filtro estragado não pode derrubar os outros.
assert.deepEqual(
  parseJobSearchParams({
    funcao: "astronauta",
    data: "31/12/2026",
    bairro: "Centro",
    pagina: "-4",
  }),
  { neighborhood: "Centro" },
);

// `?funcao=a&funcao=b` é HTTP válido: vale o primeiro.
assert.deepEqual(parseJobSearchParams({ funcao: ["barman", "garcom"] }), {
  role: "barman",
});

// --- construção de URL ------------------------------------------------------
assert.equal(jobsHref({}), "/vagas");
assert.equal(jobsHref({ role: "garcom" }), "/vagas?funcao=garcom");

// Página 1 não entra na URL: evita duas URLs para o mesmo conteúdo.
assert.equal(jobsHref({ role: "garcom", page: 1 }), "/vagas?funcao=garcom");
assert.equal(
  jobsHref({ role: "garcom", page: 2 }),
  "/vagas?funcao=garcom&pagina=2",
);

// Paginar preserva os filtros ativos.
assert.equal(
  jobsHref({ role: "garcom", neighborhood: "Santa Rosália" }, { page: 3 }),
  "/vagas?funcao=garcom&bairro=Santa+Ros%C3%A1lia&pagina=3",
);

// Ida e volta: o que a URL gera, o parser lê de volta igual.
const filters = {
  role: "barman" as const,
  date: "2026-10-10",
  neighborhood: "Jardim dos Estados",
  page: 4,
};
const url = new URL(`http://x${jobsHref(filters)}`);
assert.deepEqual(
  parseJobSearchParams(Object.fromEntries(url.searchParams)),
  filters,
);

// --- estado dos filtros -----------------------------------------------------
assert.equal(hasActiveFilters({}), false);
assert.equal(hasActiveFilters({ page: 2 }), false, "paginar não é filtrar");
assert.equal(hasActiveFilters({ role: "garcom" }), true);
assert.equal(hasActiveFilters({ neighborhood: "Centro" }), true);
// Sem cidade na URL a listagem abre nas cidades assinadas, então cidade
// escolhida é filtro ativo e "Limpar filtros" precisa aparecer.
assert.equal(hasActiveFilters({ cityId: "3151800" }), true);
assert.equal(
  jobsHref({ cityId: "3151800", role: "garcom" }),
  "/vagas?funcao=garcom&cidade=3151800",
);

console.log("job-search.test.ts: all checks passed");
