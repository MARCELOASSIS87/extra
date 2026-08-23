#!/usr/bin/env bash
# Extraqui — infra/db-setup-local.sh
#
# Sets the LOCAL development database up from zero, in the right order.
# Run it from the repo root, inside WSL, with the dev Postgres container already up.
#
#     ./infra/db-setup-local.sh
#
# There is a separate script for production (infra/db-deploy-prod.sh). Two files instead of one
# with a flag, on purpose: a mistyped flag is all it takes to run `migrate dev` against real
# data, and `migrate dev` RESETS the database when it detects drift. Two names cannot be
# mistyped into each other.

set -euo pipefail

cd "$(dirname "$0")/.."

API_DIR="apps/api"
SQL_DIR="infra/sql"
SEED_DIR="infra/seed"

# --- Safety belt ------------------------------------------------------------
# Refuse to touch anything that is not clearly local. This is the single most expensive
# mistake available in this project.

: "${DATABASE_URL:?DATABASE_URL não está definida. Carregue o .env antes de rodar.}"

if ! grep -Eq '@(localhost|127\.0\.0\.1)[:/]' <<<"$DATABASE_URL"; then
  echo "ABORTADO: DATABASE_URL não aponta para localhost."
  echo "Este script roda 'prisma migrate dev', que RESETA o banco quando detecta divergência."
  echo "Para produção use infra/db-deploy-prod.sh."
  exit 1
fi

echo "==> Banco local: $(sed -E 's#://[^@]+@#://***@#' <<<"$DATABASE_URL")"

# --- 1. Migrations ----------------------------------------------------------
# Reads apps/api/prisma/schema.prisma, writes SQL files under prisma/migrations/, applies them.
# The migration files are what create the tables — the schema is only the description.

echo "==> 1/4 Aplicando migrations"
( cd "$API_DIR" && pnpm prisma migrate dev )

# --- 2. Constraints ---------------------------------------------------------
# CHECKs, composite foreign keys, partial indexes, triggers and views. Prisma cannot express
# any of it, so roughly half of the model's guarantees live here. Idempotent by design, and it
# must run after EVERY migration: prisma has been known to drop hand-made partial indexes.

echo "==> 2/4 Aplicando constraints, triggers e views"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_DIR/constraints.sql"

# --- 3. Cities --------------------------------------------------------------
# Reference data, not application seed. Skipped when already loaded.

echo "==> 3/4 Carregando municípios"
"$SEED_DIR/load_cities.sh"

# --- 4. Neighbour distances -------------------------------------------------
# Heavy one-off pass. Skipped when already built.

NEIGHBOURS=$(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM city_neighbors")
if [ "$NEIGHBOURS" -gt 0 ]; then
  echo "==> 4/4 Vizinhança já calculada ($NEIGHBOURS pares) — pulando"
else
  echo "==> 4/4 Calculando distâncias entre municípios (demora alguns minutos)"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SEED_DIR/build_city_neighbors.sql"
fi

echo
echo "Banco local pronto. A API pode subir."
psql "$DATABASE_URL" -c "
  SELECT 'cidades' AS tabela, count(*) FROM cities
  UNION ALL SELECT 'pares de vizinhança', count(*) FROM city_neighbors;"
