import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

/**
 * The safety net for everything that lives inside the migrations and outside
 * `schema.prisma`: CHECKs, partial indexes, triggers and views.
 *
 * It exists because Prisma has already dropped three foreign keys on its own in
 * this project, writing a migration that was nothing but DROP CONSTRAINT. A
 * constraint that disappears is a silent failure — the database keeps accepting
 * writes, it just stopped protecting.
 *
 * The lists below are explicit on purpose. Counting rows would pass while a
 * CHECK was swapped for a different one.
 */

import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

// This test writes (and rolls back) against whatever DATABASE_URL points at.
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(env.DATABASE_URL)) {
  console.error("ABORTADO: DATABASE_URL não aponta para localhost.");
  process.exit(1);
}

// Own client, with logging off: every rejection below is an expected error, and
// the shared client in db.ts would print all four as `prisma:error`.
const prisma = new PrismaClient({
  log: [],
  datasources: { db: { url: env.DATABASE_URL } },
});

const CHECKS: ReadonlyArray<readonly [table: string, name: string]> = [
  ["attendance_records", "attendance_dispute_coherent"],
  ["attendance_records", "attendance_pending_iff_unmarked"],
  ["city_neighbors", "city_neighbors_distance_sane"],
  ["job_posts", "job_posts_applications_within_cap"],
  ["job_posts", "job_posts_ends_after_start"],
  ["job_posts", "job_posts_pay_amount_sane"],
  ["job_posts", "job_posts_reach_coherent"],
  ["job_posts", "job_posts_vacancies_positive"],
  ["reports", "reports_exactly_one_target"],
  ["workers", "workers_nearby_radius_allowed"],
];

const PARTIAL_INDEXES: ReadonlyArray<readonly [table: string, name: string]> = [
  ["attendance_records", "attendance_pending_idx"],
  ["attendance_records", "attendance_public_history_idx"],
  ["job_posts", "job_posts_open_by_city_idx"],
];

const TRIGGERS: ReadonlyArray<readonly [table: string, name: string]> = [
  ["worker_notification_cities", "worker_notification_cities_floor"],
  ["worker_notification_cities", "worker_notification_cities_limit"],
  ["worker_roles", "worker_roles_limit"],
  ["workers", "workers_adult_check"],
];

const VIEWS: readonly string[] = [
  "worker_attendance_summary",
  "worker_public_profiles",
];

/**
 * Four writes the database has to refuse. Each one runs alone, in a transaction
 * that is rolled back either way, so nothing survives the run.
 *
 * None of them bothers building the rows they point at: a CHECK is evaluated
 * while the tuple is written and a BEFORE trigger fires earlier still, both
 * ahead of the AFTER triggers that enforce foreign keys. Asserting on the
 * expected message keeps that assumption honest — if some other constraint
 * fired first, this fails loudly instead of passing for the wrong reason.
 */
const REJECTIONS: ReadonlyArray<{
  what: string;
  sql: string;
  expected: string;
}> = [
  {
    what: "worker menor de 18 anos",
    expected: "at least 18 years old",
    sql: `INSERT INTO workers
      (id, account_id, first_name, last_name, cpf, birth_date, city_id,
       neighborhood, experience, terms_version, terms_accepted_at, terms_accepted_ip)
      VALUES (gen_random_uuid(), gen_random_uuid(), 'Menor', 'Teste', '00000000000',
              current_date - INTERVAL '17 years', '3150703', 'Centro', '',
              'v1', now(), '127.0.0.1')`,
  },
  {
    what: "applications_count acima de vacancies * 3",
    expected: "job_posts_applications_within_cap",
    sql: `INSERT INTO job_posts
      (id, company_id, city_id, slug, role, title, description, starts_at, ends_at,
       pay_amount, address, neighborhood, vacancies, applications_count, expires_at)
      VALUES (gen_random_uuid(), gen_random_uuid(), '3150703', 'teste-constraint',
              'garcom', 'Teste', 'Teste', now(), now() + INTERVAL '4 hours',
              100, 'Rua Teste, 1', 'Centro', 1, 4, now() + INTERVAL '1 day')`,
  },
  {
    what: "attendance pending com marked_at preenchido",
    expected: "attendance_pending_iff_unmarked",
    sql: `INSERT INTO attendance_records (id, application_id, status, marked_at)
      VALUES (gen_random_uuid(), gen_random_uuid(), 'pending', now())`,
  },
  {
    what: "report com os dois alvos preenchidos",
    expected: "reports_exactly_one_target",
    sql: `INSERT INTO reports (id, target_job_post_id, target_worker_id, reason)
      VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'other')`,
  },
];

/**
 * A inicial que a empresa lê na lista de candidatos. Não é constraint, é a
 * regra de exibição da view — e uma view que continua existindo pode ter
 * parado de responder certo, coisa que checar o catálogo nunca pega.
 *
 * O ponto faz parte do valor: é assim que a camada mock devolve, e as duas
 * precisam bater campo a campo.
 */
const SURNAME_INITIALS: ReadonlyArray<
  readonly [
    fullName: string,
    firstName: string,
    lastName: string,
    initial: string,
  ]
> = [
  ["Ana Paula Ferreira", "Ana", "Paula Ferreira", "F."],
  // Sufixo de geração não é sobrenome: quem lê precisa de "Silva".
  ["João Silva Junior", "João", "Silva Junior", "S."],
  ["Maria de Souza", "Maria", "de Souza", "S."],
  // Nome único: inicial vazia. Nem letra inventada, nem ponto solto.
  ["Madonna", "Madonna", "", ""],
];

let checks = 0;
const check = (ok: boolean, message: string): void => {
  checks += 1;
  assert.ok(ok, message);
};

/** Marks a transaction that has to be undone because the write went through. */
class Accepted extends Error {}

/** Undoes a transaction whose writes were only there to be read back. */
class Rollback extends Error {}

/** The database's refusal, or "" when it accepted the row. */
async function rejectionOf(sql: string): Promise<string> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(sql);
      throw new Accepted();
    });
  } catch (error) {
    return error instanceof Accepted ? "" : String(error);
  }
  return "";
}

/**
 * Insere os trabalhadores, lê a view e desfaz tudo. Precisa de conta e cidade
 * de verdade porque aqui o INSERT tem que PASSAR — nas quatro sondas acima
 * ele tem que falhar, e por isso lá as chaves estrangeiras não importam.
 */
async function initialsFromView(): Promise<string[]> {
  const ids = SURNAME_INITIALS.map(() => randomUUID());
  const found: string[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      // Uma conta por trabalhador: `workers.account_id` é único (§7.2).
      const accountIds = SURNAME_INITIALS.map(() => randomUUID());

      for (const [
        index,
        [, firstName, lastName],
      ] of SURNAME_INITIALS.entries()) {
        await tx.$executeRawUnsafe(
          `INSERT INTO accounts (id, phone) VALUES ($1::uuid, $2)`,
          accountIds[index],
          `+55359000000${String(index).padStart(2, "0")}`,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO workers
             (id, account_id, first_name, last_name, cpf, birth_date, city_id,
              neighborhood, experience, terms_version, terms_accepted_at, terms_accepted_ip)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5::char(11), DATE '1990-01-01',
                   '3151800', 'Centro', '', 'v1', now(), '127.0.0.1')`,
          ids[index],
          accountIds[index],
          firstName,
          lastName,
          String(90000000000 + index),
        );
      }

      // Lidos pelos ids inseridos, na ordem em que foram inseridos: filtrar por
      // nome encostaria em quem o seed já pôs no banco.
      const rows = await tx.$queryRawUnsafe<
        { id: string; last_name_initial: string }[]
      >(
        `SELECT id, last_name_initial FROM worker_public_profiles
          WHERE id = ANY($1::uuid[])`,
        ids,
      );
      const byId = new Map(rows.map((row) => [row.id, row.last_name_initial]));
      for (const id of ids) {
        const initial = byId.get(id);
        if (initial !== undefined) found.push(initial);
      }

      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }

  return found;
}

async function main(): Promise<void> {
  // --- 1. The catalogue -----------------------------------------------------

  const found = async (sql: string): Promise<Set<string>> =>
    new Set(
      (await prisma.$queryRawUnsafe<{ key: string }[]>(sql)).map((r) => r.key),
    );

  const presentChecks = await found(`
    SELECT conrelid::regclass::text || '.' || conname AS key
    FROM pg_constraint
    WHERE contype = 'c' AND connamespace = 'public'::regnamespace`);

  for (const [table, name] of CHECKS) {
    check(presentChecks.has(`${table}.${name}`), `CHECK sumiu: ${name}`);
  }

  // Name plus WHERE: a partial index that quietly became a full one is a
  // different object with the same name.
  const presentPartials = await found(`
    SELECT tablename || '.' || indexname AS key
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexdef LIKE '% WHERE %'`);

  for (const [table, name] of PARTIAL_INDEXES) {
    check(
      presentPartials.has(`${table}.${name}`),
      `índice parcial sumiu (ou deixou de ser parcial): ${name}`,
    );
  }

  const presentTriggers = await found(`
    SELECT tgrelid::regclass::text || '.' || tgname AS key
    FROM pg_trigger WHERE NOT tgisinternal`);

  for (const [table, name] of TRIGGERS) {
    check(
      presentTriggers.has(`${table}.${name}`),
      `trigger sumiu de ${table}: ${name}`,
    );
  }

  const presentViews = await found(
    `SELECT viewname AS key FROM pg_views WHERE schemaname = 'public'`,
  );

  for (const view of VIEWS) {
    check(presentViews.has(view), `view sumiu: ${view}`);
    // Existing is not enough: a view over a dropped column still shows up in
    // pg_views and only fails when somebody selects from it.
    let selectable = true;
    try {
      await prisma.$queryRawUnsafe(`SELECT * FROM ${view} LIMIT 0`);
    } catch {
      selectable = false;
    }
    check(selectable, `view não é consultável: ${view}`);
  }

  // --- 2. Behaviour ---------------------------------------------------------

  for (const { what, sql, expected } of REJECTIONS) {
    const rejection = await rejectionOf(sql);
    check(rejection !== "", `o banco ACEITOU: ${what}`);
    check(
      rejection.includes(expected),
      `${what}: recusado por outro motivo, esperava "${expected}" em ${rejection}`,
    );
  }

  // --- 3. A inicial do sobrenome ---------------------------------------------

  const initials = await initialsFromView();
  check(
    initials.length === SURNAME_INITIALS.length,
    `a view devolveu ${initials.length} de ${SURNAME_INITIALS.length} perfis`,
  );
  for (const [index, [fullName, , , expected]] of SURNAME_INITIALS.entries()) {
    check(
      initials[index] === expected,
      `"${fullName}": esperava "${expected}", veio "${initials[index]}"`,
    );
  }

  console.log(`ok — ${checks} verificações de constraint`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
