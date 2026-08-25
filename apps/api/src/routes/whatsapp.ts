import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { failure } from "../http.js";
import { hashCode, safeEquals } from "../auth/token.js";
import {
  extractCode,
  hasValidSignature,
  phoneVariants,
  readIncomingMessage,
  sendConfirmation,
} from "../whatsapp.js";

/**
 * As duas rotas vivem num escopo próprio porque o parser de corpo é
 * encapsulado no Fastify: aqui dentro `application/json` chega como Buffer, e
 * no resto da API continua chegando como objeto já parseado.
 */
export function registerWhatsappWebhook(app: FastifyInstance): void {
  app.register(async (scope) => {
    scope.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_request, body, done) => done(null, body),
    );

    /**
     * Handshake de assinatura do webhook no painel da Meta (§11.3). Responde o
     * desafio em texto puro, e só quando o token confere.
     */
    scope.get<{
      Querystring: {
        "hub.mode"?: string;
        "hub.verify_token"?: string;
        "hub.challenge"?: string;
      };
    }>("/v1/webhooks/whatsapp", async (request, reply) => {
      const query = request.query;
      const expected = env.WHATSAPP_VERIFY_TOKEN;

      if (
        !expected ||
        query["hub.mode"] !== "subscribe" ||
        !query["hub.verify_token"] ||
        !safeEquals(query["hub.verify_token"], expected)
      ) {
        return reply.status(403).send(failure("forbidden", "Token inválido."));
      }

      return reply.type("text/plain").send(query["hub.challenge"] ?? "");
    });

    /**
     * O ponto mais sensível do sistema: quem consegue forjar uma chamada aqui
     * entra como qualquer pessoa da base. Por isso a assinatura é conferida
     * sobre os bytes crus ANTES de o corpo virar objeto — e por isso o corpo
     * chega como Buffer, sem parser de JSON nenhum nesta rota.
     */
    scope.post("/v1/webhooks/whatsapp", async (request, reply) => {
      const rawBody = request.body;

      // Cabeçalho repetido chega como array. Duas assinaturas é tentativa de
      // confundir o verificador, não distração: recusa.
      const signature = request.headers["x-hub-signature-256"];

      if (
        !Buffer.isBuffer(rawBody) ||
        typeof signature !== "string" ||
        !hasValidSignature(rawBody, signature)
      ) {
        // Nada é lido, nada é gravado. Só o registro de que alguém tentou.
        request.log.warn(
          { bytes: Buffer.isBuffer(rawBody) ? rawBody.length : 0 },
          "webhook do WhatsApp com assinatura inválida",
        );
        return reply
          .status(401)
          .send(failure("unauthorized", "Assinatura inválida."));
      }

      let payload: Prisma.InputJsonValue;
      try {
        payload = JSON.parse(rawBody.toString("utf8")) as Prisma.InputJsonValue;
      } catch {
        return reply
          .status(400)
          .send(failure("validation_error", "Corpo inválido."));
      }

      const message = readIncomingMessage(payload);
      // Status de entrega e leitura chegam no mesmo endpoint. Devolver erro
      // faria a Meta reenviar o mesmo evento para sempre.
      if (!message) return reply.send({ received: true });

      // A idempotência é o índice único: a segunda entrega do mesmo `wamid`
      // falha ao inserir e para aqui, em vez de consumir outro código.
      try {
        await prisma.whatsappEvent.create({
          data: { messageId: message.messageId, payload, signatureOk: true },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          request.log.info("evento do WhatsApp repetido — ignorado");
          return reply.send({ received: true });
        }
        throw error;
      }

      const code = extractCode(message.text);
      if (!code) return reply.send({ received: true });

      // O telefone vem do remetente que o WhatsApp validou, nunca do texto.
      const candidates = await prisma.phoneVerificationCode.findMany({
        where: {
          phone: { in: phoneVariants(message.from) },
          verifiedAt: null,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true, phone: true, codeHash: true },
      });

      const matched = candidates.find((candidate) =>
        safeEquals(candidate.codeHash, hashCode(candidate.phone, code)),
      );

      if (!matched) {
        request.log.info("código do WhatsApp sem tentativa correspondente");
        return reply.send({ received: true });
      }

      // A marcação da tentativa e o nascimento da conta são um ato só: conta
      // criada sem tentativa marcada deixaria o código valendo de novo.
      await prisma.$transaction([
        prisma.phoneVerificationCode.updateMany({
          where: { id: matched.id, verifiedAt: null },
          data: { verifiedAt: new Date() },
        }),
        prisma.account.upsert({
          where: { phone: matched.phone },
          update: { phoneVerifiedAt: new Date() },
          create: { phone: matched.phone, phoneVerifiedAt: new Date() },
        }),
        prisma.whatsappEvent.updateMany({
          where: { messageId: message.messageId },
          data: { processedAt: new Date() },
        }),
      ]);

      // "Confirmado!" na mesma janela (§11.1, passo 7). Fora do caminho da
      // resposta: a Meta reenvia o evento se o 200 demorar, e a posse do
      // número já está provada — mandar o aviso é cortesia, não credencial.
      void sendConfirmation(message.from).catch((error: unknown) => {
        request.log.warn({ err: error }, "falha ao responder no WhatsApp");
      });

      return reply.send({ received: true });
    });
  });
}
