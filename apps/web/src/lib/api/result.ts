import type { ApiResult } from "@extra/shared/types/api";

// Erro é valor de retorno, não exceção (CLAUDE.md). Estes dois construtores
// continuam valendo quando a Fase 4 trocar o mock pelo cliente HTTP real.

export function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

export function err<T>(
  code: string,
  message: string,
  field?: string,
): ApiResult<T> {
  return {
    ok: false,
    error: field ? { code, message, field } : { code, message },
  };
}
