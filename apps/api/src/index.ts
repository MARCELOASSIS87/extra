import { prisma } from "./db.js";
import { env } from "./env.js";
import { buildServer } from "./server.js";

const app = buildServer();

/**
 * Desligar é passo com ordem: para de aceitar requisição, deixa as que estão
 * em voo terminarem, e só então solta o pool do Postgres. Invertido, uma
 * requisição no meio do caminho morre com erro de conexão.
 */
async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, "encerrando");
  try {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, "falha ao encerrar");
    process.exit(1);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void shutdown(signal));
}

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (error) {
  app.log.error({ err: error }, "falha ao subir");
  await prisma.$disconnect();
  process.exit(1);
}
