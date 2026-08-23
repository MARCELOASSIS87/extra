-- Extraqui — infra/sql/constraints.sql
--
-- Everything Prisma cannot express: CHECK constraints, composite foreign keys, partial
-- indexes, triggers and views. Roughly half of this model's legal defence lives here.
--
-- Run AFTER every `prisma migrate dev` / `prisma migrate deploy`:
--     psql "$DATABASE_URL" -f infra/sql/constraints.sql
--
-- The file is idempotent: it can be run any number of times. It has to be, because
-- `prisma migrate` has been reported to emit DROP statements for hand-made partial indexes it
-- does not recognise. A constraint that disappears is silent — the database keeps accepting
-- writes, it just stopped protecting. Pair this file with a test that asserts every constraint
-- below still exists.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Job posts
-- ---------------------------------------------------------------------------

ALTER TABLE job_posts DROP CONSTRAINT IF EXISTS job_posts_ends_after_start;
ALTER TABLE job_posts ADD CONSTRAINT job_posts_ends_after_start
  CHECK (ends_at > starts_at);

ALTER TABLE job_posts DROP CONSTRAINT IF EXISTS job_posts_vacancies_positive;
ALTER TABLE job_posts ADD CONSTRAINT job_posts_vacancies_positive
  CHECK (vacancies > 0 AND vacancies <= 100);

-- The application cap (§16.5). This is not decoration: the API increments
-- applications_count in the same transaction as the INSERT into applications, so two people
-- applying for the last slot at the same instant resolve here — the second one violates the
-- CHECK and becomes a 409. Enforcing this in application code requires an explicit row lock
-- that nobody remembers to write at 23:00.
ALTER TABLE job_posts DROP CONSTRAINT IF EXISTS job_posts_applications_within_cap;
ALTER TABLE job_posts ADD CONSTRAINT job_posts_applications_within_cap
  CHECK (applications_count >= 0 AND applications_count <= vacancies * 3);

ALTER TABLE job_posts DROP CONSTRAINT IF EXISTS job_posts_pay_amount_sane;
ALTER TABLE job_posts ADD CONSTRAINT job_posts_pay_amount_sane
  CHECK (pay_amount >= 0);

-- reach_radius_km exists only for reach = 'nearby', and is mandatory there. Without this,
-- 'city_only' rows carrying a stale radius would be a bug waiting for a future refactor to
-- start reading the column.
ALTER TABLE job_posts DROP CONSTRAINT IF EXISTS job_posts_reach_coherent;
ALTER TABLE job_posts ADD CONSTRAINT job_posts_reach_coherent
  CHECK (
    (reach = 'nearby' AND reach_radius_km IS NOT NULL AND reach_radius_km BETWEEN 1 AND 100)
    OR (reach <> 'nearby' AND reach_radius_km IS NULL)
  );

-- The public listing only ever reads open jobs. After a few months the closed ones are the
-- bulk of the table.
DROP INDEX IF EXISTS job_posts_open_by_city_idx;
CREATE INDEX job_posts_open_by_city_idx
  ON job_posts (city_id, role, starts_at)
  WHERE status = 'open';

-- ---------------------------------------------------------------------------
-- 2. Attendance — the denormalised columns must not be able to lie
--
-- attendance_records carries worker_id, company_id and job_post_id copied from the
-- application it belongs to. Without these composite foreign keys those copies age and one
-- day point at the wrong person — on the table that decides whether someone gets called to
-- work. With them, the database refuses.
-- ---------------------------------------------------------------------------

ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_matches_application_worker;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_matches_application_worker
  FOREIGN KEY (application_id, worker_id)
  REFERENCES applications (id, worker_id)
  ON DELETE CASCADE;

ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_matches_application_job;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_matches_application_job
  FOREIGN KEY (application_id, job_post_id)
  REFERENCES applications (id, job_post_id)
  ON DELETE CASCADE;

ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_matches_job_company;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_matches_job_company
  FOREIGN KEY (job_post_id, company_id)
  REFERENCES job_posts (id, company_id)
  ON DELETE CASCADE;

-- pending means not marked yet, and nothing else.
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_pending_iff_unmarked;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_pending_iff_unmarked
  CHECK ((status = 'pending') = (marked_at IS NULL));

-- A resolution cannot exist without a dispute, and an outcome cannot exist without a
-- resolution.
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_dispute_coherent;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_dispute_coherent
  CHECK (
    (disputed_at IS NOT NULL OR (dispute_resolved_at IS NULL AND dispute_outcome IS NULL))
    AND ((dispute_resolved_at IS NULL) = (dispute_outcome IS NULL))
  );

-- Public history reads only settled markings from the last 12 months.
DROP INDEX IF EXISTS attendance_public_history_idx;
CREATE INDEX attendance_public_history_idx
  ON attendance_records (worker_id, marked_at)
  WHERE status IN ('present', 'absent');

-- ---------------------------------------------------------------------------
-- 3. Reports — exactly one target
-- ---------------------------------------------------------------------------

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_exactly_one_target;
ALTER TABLE reports ADD CONSTRAINT reports_exactly_one_target
  CHECK (num_nonnulls(target_job_post_id, target_worker_id) = 1);

-- ---------------------------------------------------------------------------
-- 3.1 Neighbourhood radius
-- ---------------------------------------------------------------------------

-- Closed set of values, not a free number. A free field invites 300 km, which turns the
-- notification into noise and costs the push permission — and that is not recoverable.
ALTER TABLE workers DROP CONSTRAINT IF EXISTS workers_nearby_radius_allowed;
ALTER TABLE workers ADD CONSTRAINT workers_nearby_radius_allowed
  CHECK (nearby_radius_km IS NULL OR nearby_radius_km IN (25, 50));

ALTER TABLE city_neighbors DROP CONSTRAINT IF EXISTS city_neighbors_distance_sane;
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

DROP TRIGGER IF EXISTS workers_adult_check ON workers;
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

DROP TRIGGER IF EXISTS worker_roles_limit ON worker_roles;
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

DROP TRIGGER IF EXISTS worker_notification_cities_limit ON worker_notification_cities;
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

DROP TRIGGER IF EXISTS worker_notification_cities_floor ON worker_notification_cities;
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
  count(DISTINCT a.company_id)
    FILTER (WHERE a.status IN ('present', 'absent'))                    AS distinct_companies,
  (count(*) FILTER (WHERE a.status IN ('present', 'absent')) > 0)       AS has_history
FROM workers w
LEFT JOIN attendance_records a
       ON a.worker_id = w.id
      AND a.marked_at > now() - INTERVAL '12 months'
      AND NOT (a.disputed_at IS NOT NULL AND a.dispute_resolved_at IS NULL)
GROUP BY w.id;

COMMIT;

-- ---------------------------------------------------------------------------
-- Not enforceable in the database, and therefore enforced in CI
--
-- Rule 1 — "the worker never pays" — is an ABSENCE. There is no
-- CHECK (no billing table references Worker). The only mechanical defence is a test that
-- reads schema.prisma and fails when any model related to Worker gains a monetary field, or
-- when any model named like payment/charge/invoice/subscription gains a relation to Worker.
-- Ugly, and the only thing that works. Without it the rule depends on somebody remembering.
-- ---------------------------------------------------------------------------
