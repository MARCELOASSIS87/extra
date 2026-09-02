import { z } from "zod";
import { cityIdSchema } from "./city";
import { phoneE164Schema } from "./phone";

function isValidCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const checkDigit = (base: string, weights: number[]): number => {
    const sum = base
      .split("")
      .reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = checkDigit(cnpj.slice(0, 12), firstWeights);
  const d2 = checkDigit(cnpj.slice(0, 12) + d1, secondWeights);

  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

// Cadastro da empresa: CNPJ, razão social, responsável, telefone e e-mail (mo-negocio §5).
export const companyRegistrationSchema = z.object({
  cnpj: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine(isValidCnpj, "CNPJ inválido"),
  legalName: z.string().trim().min(1, "Informe a razão social"),
  tradeName: z.string().trim().min(1, "Informe o nome fantasia"),
  responsibleName: z.string().trim().min(1, "Informe o nome do responsável"),
  phone: phoneE164Schema,
  email: z.email("E-mail inválido"),
  /**
   * Onde a empresa está registrada. NÃO é a cidade da vaga — aquela é
   * escolhida a cada anúncio, porque é onde o trabalho acontece. Esta serve
   * de padrão no formulário de publicar e de contexto no cadastro.
   */
  cityId: cityIdSchema,
  termsAccepted: z
    .boolean()
    .refine((value) => value, "É preciso aceitar os termos de uso"),
});

export type CompanyRegistrationInput = z.infer<
  typeof companyRegistrationSchema
>;

/**
 * PATCH /v1/companies/me — parcial, como todo cadastro que salva por etapa.
 *
 * O DOCUMENTO não entra: identidade não se reescreve por PATCH. Trocar o CNPJ
 * de uma empresa já cadastrada é criar outra empresa com o histórico da
 * primeira — vaga publicada, candidatura e presença marcada passariam a
 * pertencer a quem não as gerou.
 */
export const companyProfileUpdateSchema = companyRegistrationSchema
  .omit({ cnpj: true, termsAccepted: true })
  .partial();

export type CompanyProfileUpdate = z.infer<typeof companyProfileUpdateSchema>;
