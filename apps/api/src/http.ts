import type { ApiResult } from "@extra/shared/types/api";

/**
 * Erro no formato do §7.8. Mora fora do `server.ts` porque o tratador global
 * e as rotas precisam da mesma função — duas cópias é como uma delas passa a
 * responder num formato que o cliente não sabe ler.
 */
export const failure = (
  code: string,
  message: string,
  field?: string,
): ApiResult<never> => ({
  ok: false,
  error: field ? { code, message, field } : { code, message },
});

export const success = <T>(data: T): ApiResult<T> => ({ ok: true, data });
