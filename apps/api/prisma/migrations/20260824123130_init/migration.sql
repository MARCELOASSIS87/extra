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
    "worker_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "job_post_id" UUID NOT NULL,
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
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "request_ip" INET,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_events" (
    "id" UUID NOT NULL,
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
CREATE UNIQUE INDEX "applications_id_worker_id_key" ON "applications"("id", "worker_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_id_job_post_id_key" ON "applications"("id", "job_post_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_application_id_key" ON "attendance_records"("application_id");

-- CreateIndex
CREATE INDEX "attendance_records_worker_id_marked_at_idx" ON "attendance_records"("worker_id", "marked_at");

-- CreateIndex
CREATE INDEX "attendance_records_company_id_status_idx" ON "attendance_records"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_worker_id_idx" ON "push_subscriptions"("worker_id");

-- CreateIndex
CREATE INDEX "phone_verification_codes_phone_created_at_idx" ON "phone_verification_codes"("phone", "created_at");

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
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_job_post_id_fkey" FOREIGN KEY ("job_post_id") REFERENCES "job_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
