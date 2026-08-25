import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { OTP_CODE_LENGTH } from "@extra/shared/constants/auth";
import { env } from "./env.js";

const GRAPH_VERSION = "v21.0";

/**
 * Confere `X-Hub-Signature-256` sobre os BYTES que chegaram, nunca sobre o
 * JSON reserializado: `JSON.parse` seguido de `JSON.stringify` reordena chave
 * e muda escape, e a assinatura correta passa a falhar — o que empurra quem
 * está com pressa a desligar a verificação.
 *
 * Sem segredo configurado a resposta é `false`. Falhar fechado é o único
 * padrão aceitável aqui: webhook forjado neste endpoint é login como qualquer
 * pessoa da base.
 */
export function hasValidSignature(
  rawBody: Buffer,
  header: string | undefined,
): boolean {
  if (!env.WHATSAPP_APP_SECRET || !header?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", env.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest();
  const received = Buffer.from(header.slice("sha256=".length), "hex");

  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

/**
 * O envelope da Meta, validado antes de qualquer leitura. Fica aqui e não em
 * `packages/shared` de propósito: shared guarda o contrato entre o nosso front
 * e a nossa API, e este payload é de terceiro — o front nunca o vê.
 *
 * Quase tudo é opcional porque a Meta manda no mesmo endpoint eventos que não
 * são mensagem (status de entrega, leitura). Eles chegam, não casam, e saem
 * com 200 — devolver erro faz a Meta reenviar para sempre.
 */
const webhookPayloadSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              value: z.object({
                messages: z
                  .array(
                    z.object({
                      id: z.string().min(1),
                      from: z.string().min(1),
                      text: z.object({ body: z.string() }).optional(),
                    }),
                  )
                  .optional(),
              }),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

export interface IncomingMessage {
  messageId: string;
  /** Remetente validado pelo WhatsApp. Nunca sai do corpo da mensagem. */
  from: string;
  text: string;
}

/** A primeira mensagem de texto do lote, ou `null` se o evento não for isso. */
export function readIncomingMessage(payload: unknown): IncomingMessage | null {
  const parsed = webhookPayloadSchema.safeParse(payload);
  if (!parsed.success) return null;

  for (const entry of parsed.data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value.messages ?? []) {
        if (message.text) {
          return {
            messageId: message.id,
            from: message.from,
            text: message.text.body,
          };
        }
      }
    }
  }

  return null;
}

/** O código dentro do texto que a pessoa mandou. */
export function extractCode(text: string): string | null {
  return text.match(new RegExp(`\\d{${OTP_CODE_LENGTH}}`))?.[0] ?? null;
}

/**
 * As formas E.164 pelas quais o mesmo celular brasileiro pode chegar. A Meta
 * devolve `from` sem o "+", e para parte dos números de 55 devolve sem o nono
 * dígito — o número que a pessoa digitou no cadastro e o que o WhatsApp
 * assina são o mesmo telefone escrito de dois jeitos.
 *
 * Sem isto o login simplesmente nunca confirma para essas pessoas, e o erro
 * aparece como "não recebi nada", que é o defeito mais caro de diagnosticar.
 */
export function phoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  const variants = new Set([`+${digits}`]);

  const brazilian = digits.match(/^55(\d{2})(\d{8,9})$/);
  if (brazilian) {
    const [, area, local] = brazilian;
    if (local.length === 9 && local.startsWith("9")) {
      variants.add(`+55${area}${local.slice(1)}`);
    }
    if (local.length === 8) {
      variants.add(`+55${area}9${local}`);
    }
  }

  return [...variants];
}

/** O link do passo 3 do §11.1: um toque, mensagem já escrita. */
export function buildWaLink(code: string): string | null {
  if (!env.WHATSAPP_BUSINESS_NUMBER) return null;

  const text = encodeURIComponent(`Confirmar meu numero: ${code}`);
  return `https://wa.me/${env.WHATSAPP_BUSINESS_NUMBER}?text=${text}`;
}

/**
 * Responde "Confirmado!" na mesma janela de atendimento aberta pela mensagem
 * do usuário (§11.1, passo 7) — conversa que o usuário inicia é gratuita.
 *
 * Falha aqui não derruba o login: a posse do número já foi provada quando a
 * mensagem chegou assinada. Mandar o aviso é cortesia, não credencial.
 */
export async function sendConfirmation(to: string): Promise<boolean> {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return false;

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: "Confirmado! Pode voltar para o Extraqui." },
      }),
    },
  );

  return response.ok;
}
