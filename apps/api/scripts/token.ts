import { PrismaClient } from "@prisma/client";
import { signSessionToken } from "../src/auth/token.js";

/**
 * Gera um JWT de sessão para uma conta JÁ SEMEADA, para desenvolver o front
 * em `NEXT_PUBLIC_API_MODE=live` sem passar pelo WhatsApp:
 *
 *   pnpm -F api token --phone=5535999990001
 *
 * É SCRIPT, e não rota, de propósito: rota de login de desenvolvimento é
 * superfície que sobe junto com o servidor e vai para produção por engano
 * numa variável de ambiente esquecida. Este arquivo mora fora de `src/`,
 * então nem entra no `dist` que o contêiner roda — não há o que desligar.
 *
 * Não cria conta e não altera nada: se o telefone não existe, é porque o
 * seed não rodou.
 */

// Mesma trava do seed: um token de produção emitido pela linha de comando é
// uma sessão de usuário real na mão de quem rodou o comando.
const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DATABASE_URL)) {
  console.error("ABORTADO: DATABASE_URL não aponta para localhost.");
  console.error("Este script emite sessão válida — ver CLAUDE.md.");
  process.exit(1);
}

const phoneArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith("--phone="))
  ?.slice("--phone=".length);

if (!phoneArg) {
  console.error("uso: pnpm -F api token --phone=5535999990001");
  process.exit(1);
}

// A coluna guarda E.164 COM o "+". Copiar de fixture costuma trazer
// "+55 (35) 99999-0001" ou o número sem o prefixo, então normaliza para o
// formato gravado em vez de exigir que quem roda acerte a pontuação.
const digits = phoneArg.replace(/\D/g, "");
const phone = `+${digits}`;

const prisma = new PrismaClient({ log: ["warn", "error"] });

const account = await prisma.account.findUnique({
  where: { phone },
  select: {
    id: true,
    sessionVersion: true,
    worker: { select: { firstName: true } },
    company: { select: { tradeName: true } },
  },
});

if (!account) {
  console.error(`Nenhuma conta com o telefone ${phone}.`);
  console.error("Rode `pnpm -F api seed` e confira os telefones das fixtures.");
  await prisma.$disconnect();
  process.exit(1);
}

const token = await signSessionToken(account.id, account.sessionVersion);
const who = account.company
  ? `empresa ${account.company.tradeName}`
  : account.worker
    ? `trabalhador ${account.worker.firstName}`
    : "conta sem perfil";

console.error(`# ${who} (${phone})`);
console.error("# no navegador, no console do front:");
console.error(`localStorage.setItem("extra_session_token", "${token}")`);
// O token sozinho no stdout: `pnpm -F api token --phone=... | tail -1` serve
// para script, enquanto as instruções acima vão para o stderr.
console.log(token);

await prisma.$disconnect();
