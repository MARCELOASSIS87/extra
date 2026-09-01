// Sem 0/O/1/I: ambíguos demais para copiar de uma mensagem de WhatsApp.
const SHORT_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Código de 4 caracteres que casa a conversa do WhatsApp com a candidatura
 * (§16.5). Único DENTRO da vaga, não no mundo: a mensagem já carrega a vaga,
 * e um código curto o bastante para ser digitado colide de vez em quando —
 * quem resolve a colisão é o índice único, com nova tentativa.
 *
 * Mora no shared porque o mock e a rota precisam do mesmo alfabeto: código
 * gerado com dois alfabetos diferentes é duas regras para a mesma coisa.
 */
export function randomShortCode(): string {
  let code = "";
  for (let index = 0; index < 4; index += 1) {
    code +=
      SHORT_CODE_CHARS[Math.floor(Math.random() * SHORT_CODE_CHARS.length)];
  }
  return code;
}
