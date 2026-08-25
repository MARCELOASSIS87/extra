import { z } from "zod";
import { phoneE164Schema } from "./phone";

export const requestCodeSchema = z.object({
  phone: phoneE164Schema,
});
export type RequestCodeInput = z.infer<typeof requestCodeSchema>;

/**
 * 32 bytes aleatórios em base64url dão 43 caracteres. Validar o formato antes
 * de ir ao banco descarta lixo sem consulta — e o `:attemptId` da URL é o
 * único identificador do polling, porque polling por telefone (§11.1) deixa
 * qualquer um perguntar se um número tem conta.
 */
export const attemptIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "Tentativa inválida");
