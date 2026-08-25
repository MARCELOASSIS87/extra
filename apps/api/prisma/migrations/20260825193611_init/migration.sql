-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('incomplete', 'complete', 'self_deactivated');

-- CreateEnum
CREATE TYPE "AvailabilityPeriod" AS ENUM ('morning', 'afternoon', 'night');

-- CreateEnum
CREATE TYPE "JobRole" AS ENUM ('garcom', 'cozinheiro', 'auxiliar_cozinha', 'auxiliar_limpeza', 'diarista', 'barman', 'seguranca', 'recepcionista', 'montagem_evento', 'motorista', 'outro');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('open', 'filled', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "JobReach" AS ENUM ('unrestricted', 'nearby', 'city_only');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('applied', 'confirmed', 'withdrawn', 'no_response');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('pending', 'not_selected', 'present', 'absent');

-- CreateEnum
CREATE TYPE "DisputeOutcome" AS ENUM ('upheld', 'reversed');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'suspended', 'cancelled');

-- CreateEnum
CREATE TYPE "ContractorDocumentType" AS ENUM ('cnpj', 'cpf');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('discriminatory_content', 'fake_job', 'fake_profile', 'offensive_content', 'other');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('dismissed', 'content_removed', 'account_deactivated');

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "phone_verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" CHAR(7) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "city_neighbors" (
    "city_id" CHAR(7) NOT NULL,
    "neighbor_city_id" CHAR(7) NOT NULL,
    "distance_km" SMALLINT NOT NULL,

    CONSTRAINT "city_neighbors_pkey" PRIMARY KEY ("city_id","neighbor_city_id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(120) NOT NULL,
    "cpf" CHAR(11) NOT NULL,
    "birth_date" DATE NOT NULL,
    "city_id" CHAR(7) NOT NULL,
    "neighborhood" VARCHAR(120) NOT NULL,
    "nearby_radius_km" SMALLINT,
    "experience" TEXT NOT NULL,
    "document_selfie_key" VARCHAR(255),
    "intro_video_key" VARCHAR(255),
    "status" "WorkerStatus" NOT NULL DEFAULT 'incomplete',
    "terms_version" VARCHAR(20) NOT NULL,
    "terms_accepted_at" TIMESTAMPTZ(3) NOT NULL,
    "terms_accepted_ip" INET NOT NULL,
    "profile_completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_roles" (
    "worker_id" UUID NOT NULL,
    "role" "JobRole" NOT NULL,

    CONSTRAINT "worker_roles_pkey" PRIMARY KEY ("worker_id","role")
);

-- CreateTable
CREATE TABLE "worker_availability" (
    "worker_id" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "period" "AvailabilityPeriod" NOT NULL,

    CONSTRAINT "worker_availability_pkey" PRIMARY KEY ("worker_id","weekday","period")
);

-- CreateTable
CREATE TABLE "worker_notification_cities" (
    "worker_id" UUID NOT NULL,
    "city_id" CHAR(7) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_notification_cities_pkey" PRIMARY KEY ("worker_id","city_id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "document_type" "ContractorDocumentType" NOT NULL DEFAULT 'cnpj',
    "document" VARCHAR(14) NOT NULL,
    "legal_name" VARCHAR(200) NOT NULL,
    "trade_name" VARCHAR(200) NOT NULL,
    "responsible_name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "city_id" CHAR(7) NOT NULL,
    "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "gateway_customer_id" VARCHAR(64),
    "trial_ends_at" TIMESTAMPTZ(3),
    "subscription_ends_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_posts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "city_id" CHAR(7) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "role" "JobRole" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "pay_amount" DECIMAL(10,2) NOT NULL,
    "pay_note" VARCHAR(160),
    "address" VARCHAR(200) NOT NULL,
    "neighborhood" VARCHAR(120) NOT NULL,
    "requirements" TEXT,
    "provides_transport" BOOLEAN NOT NULL DEFAULT false,
    "reach" "JobReach" NOT NULL DEFAULT 'unrestricted',
    "reach_radius_km" SMALLINT,
    "vacancies" SMALLINT NOT NULL,
    "applications_count" INTEGER NOT NULL DEFAULT 0,
    "status" "JobStatus" NOT NULL DEFAULT 'open',
    "is_highlighted" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "job_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "job_post_id" UUID NOT NULL,
    "worker_id" UUID,
    "short_code" CHAR(4) NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'applied',
    "applied_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contacted_at" TIMESTAMPTZ(3),
    "confirmed_at" TIMESTAMPTZ(3),

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'pending',
    "marked_at" TIMESTAMPTZ(3),
    "disputed_at" TIMESTAMPTZ(3),
    "dispute_resolved_at" TIMESTAMPTZ(3),
    "dispute_outcome" "DisputeOutcome",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "worker_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "subscription" JSONB NOT NULL,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_success_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_verification_codes" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "attempt_id_hash" CHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "request_ip" INET,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "verified_at" TIMESTAMPTZ(3),
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_events" (
    "id" UUID NOT NULL,
    "message_id" VARCHAR(120),
    "payload" JSONB NOT NULL,
    "signature_ok" BOOLEAN NOT NULL,
    "processed_at" TIMESTAMPTZ(3),
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "external_id" VARCHAR(120) NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMPTZ(3),
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_job_attempts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "matched_terms" TEXT[],
    "request_ip" INET,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_job_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "reporter_account_id" UUID,
    "target_job_post_id" UUID,
    "target_worker_id" UUID,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "action" "ModerationActionType" NOT NULL,
    "actor_label" VARCHAR(80) NOT NULL,
    "notes" TEXT,
    "decided_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deletion_log" (
    "id" UUID NOT NULL,
    "subject_kind" VARCHAR(20) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deletion_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_phone_key" ON "accounts"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "cities_slug_key" ON "cities"("slug");

-- CreateIndex
CREATE INDEX "cities_uf_name_idx" ON "cities"("uf", "name");

-- CreateIndex
CREATE INDEX "city_neighbors_city_id_distance_km_neighbor_city_id_idx" ON "city_neighbors"("city_id", "distance_km", "neighbor_city_id");

-- CreateIndex
CREATE INDEX "city_neighbors_neighbor_city_id_distance_km_idx" ON "city_neighbors"("neighbor_city_id", "distance_km");

-- CreateIndex
CREATE UNIQUE INDEX "workers_account_id_key" ON "workers"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "workers_cpf_key" ON "workers"("cpf");

-- CreateIndex
CREATE INDEX "workers_city_id_status_idx" ON "workers"("city_id", "status");

-- CreateIndex
CREATE INDEX "worker_roles_role_worker_id_idx" ON "worker_roles"("role", "worker_id");

-- CreateIndex
CREATE INDEX "worker_availability_weekday_period_worker_id_idx" ON "worker_availability"("weekday", "period", "worker_id");

-- CreateIndex
CREATE INDEX "worker_notification_cities_city_id_worker_id_idx" ON "worker_notification_cities"("city_id", "worker_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_account_id_key" ON "companies"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_document_key" ON "companies"("document");

-- CreateIndex
CREATE UNIQUE INDEX "companies_gateway_customer_id_key" ON "companies"("gateway_customer_id");

-- CreateIndex
CREATE INDEX "companies_subscription_status_idx" ON "companies"("subscription_status");

-- CreateIndex
CREATE INDEX "job_posts_city_id_status_role_starts_at_idx" ON "job_posts"("city_id", "status", "role", "starts_at");

-- CreateIndex
CREATE INDEX "job_posts_status_expires_at_idx" ON "job_posts"("status", "expires_at");

-- CreateIndex
CREATE INDEX "job_posts_company_id_published_at_idx" ON "job_posts"("company_id", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_posts_city_id_slug_key" ON "job_posts"("city_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "job_posts_id_company_id_key" ON "job_posts"("id", "company_id");

-- CreateIndex
CREATE INDEX "applications_worker_id_applied_at_idx" ON "applications"("worker_id", "applied_at");

-- CreateIndex
CREATE UNIQUE INDEX "applications_job_post_id_worker_id_key" ON "applications"("job_post_id", "worker_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_job_post_id_short_code_key" ON "applications"("job_post_id", "short_code");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_application_id_key" ON "attendance_records"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_worker_id_idx" ON "push_subscriptions"("worker_id");

-- CreateIndex
CREATE UNIQUE INDEX "phone_verification_codes_attempt_id_hash_key" ON "phone_verification_codes"("attempt_id_hash");

-- CreateIndex
CREATE INDEX "phone_verification_codes_phone_created_at_idx" ON "phone_verification_codes"("phone", "created_at");

-- CreateIndex
CREATE INDEX "phone_verification_codes_request_ip_created_at_idx" ON "phone_verification_codes"("request_ip", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_events_message_id_key" ON "whatsapp_events"("message_id");

-- CreateIndex
CREATE INDEX "whatsapp_events_received_at_idx" ON "whatsapp_events"("received_at");

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_external_id_key" ON "billing_events"("external_id");

-- CreateIndex
CREATE INDEX "billing_events_company_id_received_at_idx" ON "billing_events"("company_id", "received_at");

-- CreateIndex
CREATE INDEX "blocked_job_attempts_company_id_created_at_idx" ON "blocked_job_attempts"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "reports_created_at_idx" ON "reports"("created_at");

-- CreateIndex
CREATE INDEX "moderation_actions_report_id_idx" ON "moderation_actions"("report_id");

-- CreateIndex
CREATE INDEX "deletion_log_deleted_at_idx" ON "deletion_log"("deleted_at");

-- AddForeignKey
ALTER TABLE "city_neighbors" ADD CONSTRAINT "city_neighbors_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city_neighbors" ADD CONSTRAINT "city_neighbors_neighbor_city_id_fkey" FOREIGN KEY ("neighbor_city_id") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workers" ADD CONSTRAINT "workers_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workers" ADD CONSTRAINT "workers_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_roles" ADD CONSTRAINT "worker_roles_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_availability" ADD CONSTRAINT "worker_availability_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_notification_cities" ADD CONSTRAINT "worker_notification_cities_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_notification_cities" ADD CONSTRAINT "worker_notification_cities_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_posts" ADD CONSTRAINT "job_posts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_posts" ADD CONSTRAINT "job_posts_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_post_id_fkey" FOREIGN KEY ("job_post_id") REFERENCES "job_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_job_attempts" ADD CONSTRAINT "blocked_job_attempts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_job_post_id_fkey" FOREIGN KEY ("target_job_post_id") REFERENCES "job_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_worker_id_fkey" FOREIGN KEY ("target_worker_id") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===========================================================================
-- Everything Prisma cannot express: CHECK constraints, partial indexes,
-- triggers and views. Roughly half of this model's legal defence lives below.
--
-- It is INSIDE the migration, not in a side file applied afterwards. Applying
-- it separately was the original design and it was wrong: anything Prisma
-- models that is not in the migration history reads as permanent drift, and
-- every `migrate dev` from then on demands a full reset before it will do
-- anything. Nothing below is an object Prisma models, which is exactly why it
-- can live here without a fight.
--
-- No BEGIN/COMMIT: a migration already runs in one transaction. No
-- `DROP ... IF EXISTS`: nothing here exists yet. infra/sql/
-- constraints.reference.sql keeps a readable copy — documentation, never run.
--
-- Every new constraint goes into the migration that introduces it.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Job posts
-- ---------------------------------------------------------------------------

ALTER TABLE job_posts ADD CONSTRAINT job_posts_ends_after_start
  CHECK (ends_at > starts_at);

ALTER TABLE job_posts ADD CONSTRAINT job_posts_vacancies_positive
  CHECK (vacancies > 0 AND vacancies <= 100);

-- The application cap (§16.5). This is not decoration: the API increments
-- applications_count in the same transaction as the INSERT into applications, so two people
-- applying for the last slot at the same instant resolve here — the second one violates the
-- CHECK and becomes a 409. Enforcing this in application code requires an explicit row lock
-- that nobody remembers to write at 23:00.
ALTER TABLE job_posts ADD CONSTRAINT job_posts_applications_within_cap
  CHECK (applications_count >= 0 AND applications_count <= vacancies * 3);

ALTER TABLE job_posts ADD CONSTRAINT job_posts_pay_amount_sane
  CHECK (pay_amount >= 0);

-- reach_radius_km exists only for reach = 'nearby', and is mandatory there. Without this,
-- 'city_only' rows carrying a stale radius would be a bug waiting for a future refactor to
-- start reading the column.
ALTER TABLE job_posts ADD CONSTRAINT job_posts_reach_coherent
  CHECK (
    (reach = 'nearby' AND reach_radius_km IS NOT NULL AND reach_radius_km BETWEEN 1 AND 100)
    OR (reach <> 'nearby' AND reach_radius_km IS NULL)
  );

-- The public listing only ever reads open jobs. After a few months the closed ones are the
-- bulk of the table.
CREATE INDEX job_posts_open_by_city_idx
  ON job_posts (city_id, role, starts_at)
  WHERE status = 'open';

-- ---------------------------------------------------------------------------
-- 2. Attendance
--
-- There are no composite foreign keys here any more, and nothing to guard with them: the
-- denormalised worker_id / company_id / job_post_id columns are gone from the table. They were
-- copies of what the application already says, and the keys that kept them honest were objects
-- Prisma models — outside the migration history they read as permanent drift. The copy was
-- cheaper to delete than the guard was to keep.
-- ---------------------------------------------------------------------------

-- pending means not marked yet, and nothing else.
ALTER TABLE attendance_records ADD CONSTRAINT attendance_pending_iff_unmarked
  CHECK ((status = 'pending') = (marked_at IS NULL));

-- A resolution cannot exist without a dispute, and an outcome cannot exist without a
-- resolution.
ALTER TABLE attendance_records ADD CONSTRAINT attendance_dispute_coherent
  CHECK (
    (disputed_at IS NOT NULL OR (dispute_resolved_at IS NULL AND dispute_outcome IS NULL))
    AND ((dispute_resolved_at IS NULL) = (dispute_outcome IS NULL))
  );

-- Public history reads only settled markings from the last 12 months. Anchored on
-- application_id now that worker_id is gone: the worker is reached through the application.
CREATE INDEX attendance_public_history_idx
  ON attendance_records (application_id, marked_at)
  WHERE status IN ('present', 'absent');

-- The company's pending queue. Partial because pending is the small, hot slice: once marked, a
-- row leaves the index and never comes back.
CREATE INDEX attendance_pending_idx
  ON attendance_records (status)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- 3. Reports — exactly one target
-- ---------------------------------------------------------------------------

ALTER TABLE reports ADD CONSTRAINT reports_exactly_one_target
  CHECK (num_nonnulls(target_job_post_id, target_worker_id) = 1);

-- ---------------------------------------------------------------------------
-- 3.1 Neighbourhood radius
-- ---------------------------------------------------------------------------

-- Closed set of values, not a free number. A free field invites 300 km, which turns the
-- notification into noise and costs the push permission — and that is not recoverable.
ALTER TABLE workers ADD CONSTRAINT workers_nearby_radius_allowed
  CHECK (nearby_radius_km IS NULL OR nearby_radius_km IN (25, 50));

ALTER TABLE city_neighbors ADD CONSTRAINT city_neighbors_distance_sane
  CHECK (distance_km >= 0 AND distance_km <= 100);

-- ---------------------------------------------------------------------------
-- 4. Triggers
--
-- These four rules cannot be CHECK constraints. Postgres requires an IMMUTABLE expression in
-- a CHECK, and both current_date and "count the rows in another table" fail that test.
-- ---------------------------------------------------------------------------

-- 4.1 No minors. ECA Digital (Lei 15.211/2025).
-- Also validated in the shared zod schema — that covers the normal path. This covers the
-- paths nobody planned: a seed, a manual fix, an import script, a future task read wrong.
-- The cost of a minor getting in through a side door is not the same kind of cost as any
-- other bug in this system.
CREATE OR REPLACE FUNCTION enforce_worker_is_adult() RETURNS trigger AS $$
BEGIN
  IF NEW.birth_date > (current_date - INTERVAL '18 years') THEN
    RAISE EXCEPTION 'worker must be at least 18 years old (ECA Digital)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workers_adult_check
  BEFORE INSERT OR UPDATE OF birth_date ON workers
  FOR EACH ROW EXECUTE FUNCTION enforce_worker_is_adult();

-- 4.2 At most 5 roles per worker.
CREATE OR REPLACE FUNCTION enforce_worker_role_limit() RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM worker_roles WHERE worker_id = NEW.worker_id) > 5 THEN
    RAISE EXCEPTION 'a worker may have at most 5 roles'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER worker_roles_limit
  AFTER INSERT ON worker_roles
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_worker_role_limit();

-- 4.3 At most 5 notification cities per worker.
-- Somebody who subscribes to twenty cities gets flooded, disables notifications at the OS
-- level, and is gone for good — you do not lose the job, you lose the person.
CREATE OR REPLACE FUNCTION enforce_notification_city_limit() RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM worker_notification_cities WHERE worker_id = NEW.worker_id) > 5 THEN
    RAISE EXCEPTION 'a worker may subscribe to at most 5 cities'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER worker_notification_cities_limit
  AFTER INSERT ON worker_notification_cities
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_notification_city_limit();

-- 4.4 A complete worker cannot end up with zero notification cities.
-- Zero cities means zero notifications, which the person reads as "this site is broken" —
-- and they never tell you, they just stop coming back. Deleting the worker is allowed
-- (the CASCADE runs), only emptying the list of a live worker is not.
CREATE OR REPLACE FUNCTION enforce_notification_city_floor() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM workers WHERE id = OLD.worker_id)
     AND (SELECT count(*) FROM worker_notification_cities WHERE worker_id = OLD.worker_id) = 0
  THEN
    RAISE EXCEPTION 'a worker must keep at least one notification city'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER worker_notification_cities_floor
  AFTER DELETE ON worker_notification_cities
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_notification_city_floor();

-- ---------------------------------------------------------------------------
-- 5. Views — where three inviolable rules stop being discipline and become structure
-- ---------------------------------------------------------------------------

-- Rule 8: contact never appears in a public payload.
-- This view joins neither accounts nor any column holding cpf or birth_date. The phone is not
-- reachable from here even by someone trying. That is the point of the account/worker split.
CREATE OR REPLACE VIEW worker_public_profiles AS
SELECT
  w.id,
  w.first_name,
  left(w.last_name, 1)                     AS last_name_initial,
  c.name                                   AS city_name,
  w.neighborhood,
  w.experience,
  w.intro_video_key,
  (w.profile_completed_at IS NOT NULL)     AS has_complete_profile,
  w.created_at                             AS member_since
FROM workers w
JOIN cities c ON c.id = w.city_id
WHERE w.status <> 'self_deactivated';

-- Rules 7 and 10, plus §16.6.
--   not_selected and pending appear nowhere: neutral means neutral.
--   open disputes are excluded while unresolved.
--   markings older than 12 months are excluded.
--   has_history exists so the interface never has to interpret a zero. "0 presenças" reads as
--   bad, not as neutral, and a new component would eventually print it — that would lock every
--   newcomer out of the platform permanently.
CREATE OR REPLACE VIEW worker_attendance_summary AS
SELECT
  w.id AS worker_id,
  count(*) FILTER (WHERE a.status = 'present')                          AS present,
  count(*) FILTER (WHERE a.status = 'absent')                           AS absent,
  count(DISTINCT j.company_id)
    FILTER (WHERE a.status IN ('present', 'absent'))                    AS distinct_companies,
  (count(*) FILTER (WHERE a.status IN ('present', 'absent')) > 0)       AS has_history
FROM workers w
LEFT JOIN applications ap ON ap.worker_id = w.id
LEFT JOIN attendance_records a
       ON a.application_id = ap.id
      AND a.marked_at > now() - INTERVAL '12 months'
      AND NOT (a.disputed_at IS NOT NULL AND a.dispute_resolved_at IS NULL)
LEFT JOIN job_posts j ON j.id = ap.job_post_id
GROUP BY w.id;
