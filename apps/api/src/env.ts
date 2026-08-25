import { z } from "zod";

// Node 22 lê o .env sozinho — sem dotenv. Em contêiner o arquivo não existe e
// as variáveis vêm do ambiente, então falhar aqui não é erro.
try {
  process.loadEnvFile();
} catch {
  // sem .env: segue com o que já estiver em process.env
}

/**
 * Configuração validada na subida. Variável faltando derruba o processo com
 * mensagem clara, em vez de estourar três dias depois numa requisição — o
 * tipo de falha que só aparece em produção, no pior horário.
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (value) => value.startsWith("postgres"),
      "precisa ser uma URL de conexão do Postgres (postgresql://...)",
    ),
  PORT: z.coerce.number().int().positive().default(3333),
  // Assinatura de JWT: chave curta é chave quebrável em GPU doméstica.
  JWT_SECRET: z.string().min(32, "precisa ter ao menos 32 caracteres"),
  // Origem única do front. Nunca uma lista, nunca "*" — ver server.ts.
  CORS_ORIGIN: z.url("precisa ser a URL do front, com esquema"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // --- WhatsApp Cloud API (§11.3) -------------------------------------------
  // O número dedicado do negócio, em dígitos E.164 sem "+": é o destino do
  // link wa.me que o usuário toca para mandar o código.
  WHATSAPP_BUSINESS_NUMBER: z
    .string()
    .regex(/^[1-9]\d{7,14}$/, "dígitos E.164 sem +, ex: 5535999999999")
    .optional(),
  // Segredo do app Meta, usado para conferir X-Hub-Signature-256. Sem ele o
  // webhook recusa tudo — ver whatsapp.ts. Nunca tem valor padrão.
  WHATSAPP_APP_SECRET: z.string().min(1).optional(),
  // Token do handshake GET do webhook.
  WHATSAPP_VERIFY_TOKEN: z.string().min(1).optional(),
  // Credenciais de envio da resposta "Confirmado!". Ausentes, a confirmação
  // vira log e o login continua funcionando — mandar mensagem é efeito, não
  // parte da prova de posse do número.
  WHATSAPP_TOKEN: z.string().min(1).optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
});

/**
 * Em produção as credenciais do WhatsApp deixam de ser opcionais: sem elas
 * ninguém entra no sistema. Em desenvolvimento elas faltam o tempo todo — não
 * há app Meta na máquina de quem está mexendo em tela — e derrubar a API por
 * isso só ensina a preencher com lixo. A defesa não depende desta checagem:
 * o webhook recusa assinatura sem segredo, aqui ou lá.
 */
const requiredInProduction = [
  "WHATSAPP_BUSINESS_NUMBER",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
] as const;

const parsed = envSchema
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== "production") return;
    for (const key of requiredInProduction) {
      if (!value[key]) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "obrigatória em produção",
        });
      }
    }
  })
  .safeParse(process.env);

if (!parsed.success) {
  console.error("Configuração inválida — a API não sobe assim:\n");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  console.error("\nConfira apps/api/.env contra apps/api/.env.example.\n");
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
