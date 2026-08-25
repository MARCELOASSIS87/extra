import { z } from "zod";
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
// Cidade não entra aqui: a empresa herda a cidade da conta, atribuída pelo
// servidor. Quando existir empresa em mais de uma cidade, vira `cityId`.
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
  termsAccepted: z
    .boolean()
    .refine((value) => value, "É preciso aceitar os termos de uso"),
});

export type CompanyRegistrationInput = z.infer<
  typeof companyRegistrationSchema
>;
