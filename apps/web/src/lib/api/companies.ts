import type { ApiResult } from "@extra/shared/types/api";
import type { Company } from "@extra/shared/types/company";
import type { JobPost } from "@extra/shared/types/job";
import {
  companyRegistrationSchema,
  type CompanyRegistrationInput,
} from "@extra/shared/schemas/company";
import { CITY } from "@extra/shared/constants/city";
import { CURRENT_COMPANY_ID, nowIso, randomId, store, withMock } from "./mock";
import { err, ok } from "./result";

export async function getMyCompany(): Promise<ApiResult<Company | null>> {
  return withMock(() =>
    ok(
      store.companies.find((company) => company.id === CURRENT_COMPANY_ID) ??
        null,
    ),
  );
}

export async function createCompany(
  input: CompanyRegistrationInput,
): Promise<ApiResult<Company>> {
  return withMock(() => {
    const parsed = companyRegistrationSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return err("validation_error", issue.message, issue.path.join("."));
    }

    if (store.companies.some((company) => company.cnpj === parsed.data.cnpj)) {
      return err(
        "cnpj_already_registered",
        "Este CNPJ já tem cadastro.",
        "cnpj",
      );
    }

    const company: Company = {
      ...parsed.data,
      id: randomId(),
      city: CITY,
      // Assinatura começa em teste; cobrança é da empresa, nunca do trabalhador.
      subscriptionStatus: "trialing",
      subscriptionEndsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      createdAt: nowIso(),
    };

    store.companies = [...store.companies, company];
    return ok(company);
  });
}

/** Painel da empresa: as vagas dela em qualquer estado, mais recentes antes. */
export async function listMyCompanyJobs(): Promise<ApiResult<JobPost[]>> {
  return withMock(() =>
    ok(
      store.jobPosts
        .filter((job) => job.companyId === CURRENT_COMPANY_ID)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    ),
  );
}
