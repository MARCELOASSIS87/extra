import { Prisma, PrismaClient } from "@prisma/client";
import { env, isProduction } from "./env.js";

/**
 * `query` sai como EVENTO em todo ambiente, e nunca para o stdout: evento sem
 * ouvinte não escreve nada, e é ele que deixa um teste contar consultas sem a
 * rota saber de nada — a única forma mecânica de travar a ausência de N+1.
 * Quem assina o evento é o bloco de desenvolvimento logo abaixo.
 */
const PRISMA_LOG_BASE = [
  { emit: "event", level: "query" },
  { emit: "stdout", level: "warn" },
  { emit: "stdout", level: "error" },
] satisfies Prisma.LogDefinition[];

const PRISMA_LOG_DEVELOPMENT = [
  ...PRISMA_LOG_BASE,
  { emit: "stdout", level: "info" },
] satisfies Prisma.LogDefinition[];

/**
 * Um cliente para o processo inteiro. Instanciar por requisição estoura o
 * pool de conexões do Postgres com o servidor parecendo saudável.
 *
 * O cache em `globalThis` existe por causa do `tsx watch`: cada recarga
 * reavalia o módulo, e sem isto cada save abriria um pool novo.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient<{ log: typeof PRISMA_LOG_DEVELOPMENT }>;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? PRISMA_LOG_BASE : PRISMA_LOG_DEVELOPMENT,
    datasources: { db: { url: env.DATABASE_URL } },
  });

if (!isProduction) globalForPrisma.prisma = prisma;

/**
 * O SQL e a duração, em desenvolvimento e em nível debug. `event.params`
 * NUNCA entra: é ali que viajam CPF, telefone e hash de código OTP, e log
 * vaza igual banco — por agregador, backup e print colado no chat. Em
 * produção nem o ouvinte existe, então não há o que vazar.
 */
if (env.NODE_ENV === "development") {
  prisma.$on("query", (event) => {
    console.debug(`[prisma] ${event.duration}ms ${event.query}`);
  });
}

/** `SELECT 1`. Healthcheck que não toca o banco mente quando o banco cai. */
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
