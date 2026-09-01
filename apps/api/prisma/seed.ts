import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  applications,
  attendanceRecords,
  companies,
  jobPosts,
  workers,
} from "@extra/fixtures/fixtures";

/**
 * Seed de DESENVOLVIMENTO. Carrega no banco local exatamente as fixtures que
 * a camada mock de `apps/web` serve — uma fonte de dado falso, dois
 * consumidores. É isso que deixa comparar o JSON do mock com o da API, campo
 * a campo, na hora de trocar um pelo outro.
 *
 * Rodado à mão: `pnpm -F api seed`. De propósito FORA do campo `seed` do
 * Prisma, que dispara sozinho no `migrate dev` e no `migrate reset` — o
 * CLAUDE.md proíbe seed de aplicação em produção, e a defesa contra isso é
 * não existir gatilho automático nenhum.
 *
 * Não insere cidade: os 5.571 municípios do IBGE já estão no banco, carregados
 * por `infra/seed/load_cities.sh`. Aqui elas só são referenciadas por id.
 *
 * Se este arquivo rodar até o fim, as fixtures são coerentes com o modelo: as
 * travas do banco (maior de 18, teto de 5 funções, teto de 5 cidades, teto de
 * candidaturas, pending sem markedAt) julgam cada linha na entrada.
 */

const DATABASE_URL = process.env.DATABASE_URL ?? "";

// Mesma trava dos scripts de infra. Um seed que apaga tabela é a operação
// mais cara disponível neste projeto para se apontar para o banco errado.
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DATABASE_URL)) {
  console.error("ABORTADO: DATABASE_URL não aponta para localhost.");
  console.error("Este script APAGA as tabelas de aplicação antes de carregar.");
  console.error("Para produção não existe seed — ver CLAUDE.md.");
  process.exit(1);
}

const prisma = new PrismaClient({ log: ["warn", "error"] });

/**
 * Tudo que é dado de aplicação, na ordem em que o Postgres aceita truncar
 * junto. `cities` e `city_neighbors` NÃO estão aqui e nunca podem estar: são
 * dado de referência, custam minutos para reconstruir e nada neste seed os
 * recria.
 *
 * Um TRUNCATE só, sem CASCADE: se um dia nascer uma tabela que referencia
 * estas e ficar fora da lista, o Postgres recusa em vez de truncar em
 * silêncio — falha barulhenta é o que se quer aqui.
 */
const APPLICATION_TABLES = [
  "moderation_actions",
  "reports",
  "attendance_records",
  "applications",
  "blocked_job_attempts",
  "job_posts",
  "worker_notification_cities",
  "worker_availability",
  "worker_roles",
  "push_subscriptions",
  "workers",
  "billing_events",
  "companies",
  "whatsapp_events",
  "phone_verification_codes",
  "deletion_log",
  "accounts",
] as const;

/**
 * As fixtures guardam `fullName`; o banco guarda os dois campos separados,
 * porque o perfil público mostra o primeiro nome mais a inicial do sobrenome
 * e quebrar a string na leitura erra em "Maria de Souza".
 *
 * O corte é no primeiro espaço: o resto inteiro vira sobrenome, para
 * `firstName + " " + lastName` devolver o `fullName` de origem sem perder
 * nome do meio.
 */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") || firstName };
}

async function main(): Promise<void> {
  console.log(`==> Banco: ${DATABASE_URL.replace(/\/\/[^@]+@/, "//***@")}`);

  console.log("==> 1/4 Limpando as tabelas de aplicação");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${APPLICATION_TABLES.join(", ")} RESTART IDENTITY`,
  );

  // A conta é a credencial, separada do perfil (§7.2): o telefone mora nela e
  // em nenhum outro lugar. As fixtures carregam o telefone dentro de worker e
  // de company porque o mock não tem essa separação — aqui ela é reconstruída.
  const accountIdByWorker = new Map(workers.map((w) => [w.id, randomUUID()]));
  const accountIdByCompany = new Map(
    companies.map((c) => [c.id, randomUUID()]),
  );

  console.log("==> 2/4 Contas, trabalhadores e empresas");
  await prisma.account.createMany({
    data: [
      ...workers.map((worker) => ({
        id: accountIdByWorker.get(worker.id)!,
        phone: worker.phone,
        phoneVerifiedAt: worker.phoneVerifiedAt
          ? new Date(worker.phoneVerifiedAt)
          : null,
        createdAt: new Date(worker.createdAt),
      })),
      ...companies.map((company) => ({
        id: accountIdByCompany.get(company.id)!,
        phone: company.phone,
        // Empresa cadastrada é empresa que confirmou o número: sem isso ela
        // não teria entrado.
        phoneVerifiedAt: new Date(company.createdAt),
        createdAt: new Date(company.createdAt),
      })),
    ],
  });

  await prisma.worker.createMany({
    data: workers.map((worker) => ({
      id: worker.id,
      accountId: accountIdByWorker.get(worker.id)!,
      ...splitName(worker.fullName),
      cpf: worker.cpf,
      birthDate: new Date(worker.birthDate),
      cityId: worker.cityId,
      neighborhood: worker.neighborhood,
      nearbyRadiusKm: worker.nearbyRadiusKm,
      experience: worker.experience,
      documentSelfieKey: worker.documentSelfieKey,
      introVideoKey: worker.introVideoKey,
      status: worker.status,
      termsVersion: worker.termsVersion,
      termsAcceptedAt: new Date(worker.termsAcceptedAt),
      termsAcceptedIp: worker.termsAcceptedIp,
      profileCompletedAt: worker.profileCompletedAt
        ? new Date(worker.profileCompletedAt)
        : null,
      createdAt: new Date(worker.createdAt),
    })),
  });

  // Os três filhos do trabalhador. Cada um tem trava própria no banco: no
  // máximo 5 funções, no máximo 5 cidades de aviso.
  await prisma.workerRole.createMany({
    data: workers.flatMap((worker) =>
      worker.roles.map((role) => ({ workerId: worker.id, role })),
    ),
  });

  await prisma.workerAvailability.createMany({
    data: workers.flatMap((worker) =>
      worker.availability.map((slot) => ({
        workerId: worker.id,
        weekday: slot.weekday,
        period: slot.period,
      })),
    ),
  });

  await prisma.workerNotificationCity.createMany({
    data: workers.flatMap((worker) =>
      worker.notificationCityIds.map((cityId) => ({
        workerId: worker.id,
        cityId,
      })),
    ),
  });

  await prisma.company.createMany({
    data: companies.map((company) => ({
      id: company.id,
      accountId: accountIdByCompany.get(company.id)!,
      // A coluna se chama `document`, não `cnpj`: a v2.0 aceita contratante
      // pessoa física (§21).
      documentType: "cnpj" as const,
      document: company.cnpj,
      legalName: company.legalName,
      tradeName: company.tradeName,
      responsibleName: company.responsibleName,
      email: company.email,
      cityId: company.cityId,
      subscriptionStatus: company.subscriptionStatus,
      subscriptionEndsAt: company.subscriptionEndsAt
        ? new Date(company.subscriptionEndsAt)
        : null,
      createdAt: new Date(company.createdAt),
    })),
  });

  console.log("==> 3/4 Vagas e candidaturas");
  await prisma.jobPost.createMany({
    data: jobPosts.map((job) => ({
      id: job.id,
      companyId: job.companyId,
      cityId: job.cityId,
      slug: job.slug,
      role: job.role,
      title: job.title,
      description: job.description,
      startsAt: new Date(job.startsAt),
      endsAt: new Date(job.endsAt),
      payAmount: job.payAmount,
      payNote: job.payNote,
      address: job.address,
      neighborhood: job.neighborhood,
      requirements: job.requirements,
      providesTransport: job.providesTransport,
      reach: job.reach,
      reachRadiusKm: job.reachRadiusKm,
      vacancies: job.vacancies,
      // `maxApplications` não entra: é derivado (`vacancies * 3`) e não existe
      // como coluna. Quem passa do teto é recusado pelo CHECK sobre esta.
      applicationsCount: job.applicationsCount,
      status: job.status,
      isHighlighted: job.isHighlighted,
      publishedAt: new Date(job.publishedAt),
      expiresAt: new Date(job.expiresAt),
    })),
  });

  await prisma.application.createMany({
    data: applications.map((application) => ({
      id: application.id,
      jobPostId: application.jobPostId,
      workerId: application.workerId,
      shortCode: application.shortCode,
      status: application.status,
      appliedAt: new Date(application.appliedAt),
      contactedAt: application.contactedAt
        ? new Date(application.contactedAt)
        : null,
      confirmedAt: application.confirmedAt
        ? new Date(application.confirmedAt)
        : null,
    })),
  });

  console.log("==> 4/4 Presenças");
  // A tabela guarda só `application_id`: worker, empresa e vaga chegam pelo
  // join. As fixtures ainda carregam os três porque o mock não tem join —
  // aqui eles voltam a ser o que sempre foram, um caminho até a candidatura.
  const applicationIdByPair = new Map(
    applications.map((item) => [`${item.jobPostId}|${item.workerId}`, item.id]),
  );

  const attendanceData = attendanceRecords.map((record) => {
    const applicationId = applicationIdByPair.get(
      `${record.jobPostId}|${record.workerId}`,
    );
    // Registro de presença sem candidatura é incoerência da fixture, não caso
    // de borda: no modelo, presença é um desfecho DA candidatura. Falhar aqui
    // é o seed cumprindo o papel de conferir as fixtures contra o modelo.
    if (!applicationId) {
      throw new Error(
        `presença ${record.id} não tem candidatura (vaga ${record.jobPostId}, trabalhador ${record.workerId})`,
      );
    }
    return {
      id: record.id,
      applicationId,
      status: record.status,
      markedAt: record.markedAt ? new Date(record.markedAt) : null,
      disputedAt: record.disputedAt ? new Date(record.disputedAt) : null,
      disputeResolvedAt: record.disputeResolvedAt
        ? new Date(record.disputeResolvedAt)
        : null,
      disputeOutcome: record.disputeOutcome,
    };
  });

  await prisma.attendanceRecord.createMany({ data: attendanceData });

  await report();
}

/** Contagem por tabela: o que o banco realmente aceitou, não o que se enviou. */
async function report(): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<
    { tabela: string; linhas: bigint }[]
  >(
    APPLICATION_TABLES.map(
      (table) =>
        `SELECT '${table}' AS tabela, count(*) AS linhas FROM ${table}`,
    ).join(" UNION ALL "),
  );

  const byStatus = await prisma.attendanceRecord.groupBy({
    by: ["status"],
    _count: true,
  });
  const disputed = await prisma.attendanceRecord.count({
    where: { disputedAt: { not: null } },
  });

  console.log("\nLinhas por tabela:");
  for (const { tabela, linhas } of rows) {
    if (Number(linhas) > 0) {
      console.log(`  ${tabela.padEnd(28)} ${String(linhas).padStart(5)}`);
    }
  }

  const outcomes = byStatus
    .map((item) => `${item.status}=${item._count}`)
    .sort()
    .join("  ");
  console.log(`\nDesfechos de presença: ${outcomes}`);
  console.log(`Contestadas: ${disputed}`);
}

try {
  await main();
  console.log("\nSeed concluído.");
} finally {
  await prisma.$disconnect();
}
