import { PrismaClient } from "@prisma/client";
import { env, isProduction } from "./env.js";

/**
 * Um cliente para o processo inteiro. Instanciar por requisição estoura o
 * pool de conexões do Postgres com o servidor parecendo saudável.
 *
 * O cache em `globalThis` existe por causa do `tsx watch`: cada recarga
 * reavalia o módulo, e sem isto cada save abriria um pool novo.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ["warn", "error"] : ["warn", "error", "info"],
    datasources: { db: { url: env.DATABASE_URL } },
  });

if (!isProduction) globalForPrisma.prisma = prisma;

/** `SELECT 1`. Healthcheck que não toca o banco mente quando o banco cai. */
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
