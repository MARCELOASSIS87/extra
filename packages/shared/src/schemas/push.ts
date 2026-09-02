import { z } from "zod";

/**
 * A inscrição de push, do jeito que o navegador devolve.
 *
 * As `keys` são CREDENCIAL: quem as tem consegue enviar notificação para
 * aquele dispositivo. Por isso a rota que recebe isto nunca registra o corpo
 * em log — e por isso o schema valida a forma sem nunca desmontar o conteúdo.
 *
 * Guardado inteiro em JSONB e entregue inteiro à biblioteca de web-push: a
 * regra é JSONB para payload de terceiro em que nunca se consulta dentro.
 */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url("Inscrição de push inválida"),
  expirationTime: z.number().nullish(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
