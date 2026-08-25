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
SEED_DIR="infra/seed"

# Name for any migration this run creates. Passing --name is not cosmetic: without it, the
# FIRST run opens an interactive prompt asking for the name, and with no TTY it hangs forever
# without erroring — and the hung process keeps Prisma's advisory lock, so the next attempt
# dies with P1002 instead of showing the real problem.
# Harmless on later runs: with no schema drift, Prisma creates nothing.
MIGRATION_NAME="${1:-init}"

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

# psql (libpq) rejects Prisma-only query parameters — `?schema=public` makes it fail with
# "invalid URI query parameter". Prisma needs that parameter; libpq refuses it. So the same
# URL cannot be handed to both, and the script is what adapts.
# Dropping the whole query string is safe here: the local container has no TLS, and in
# production the connection happens inside the Docker network. If a libpq option is ever
# needed (sslmode), this line is where to make it selective.
PSQL_URL="${DATABASE_URL%%\?*}"
export PSQL_URL

# --- 1. Migrations ----------------------------------------------------------
# Reads apps/api/prisma/schema.prisma, writes SQL files under prisma/migrations/, applies them.
# The migration files are what create the tables — the schema is only the description.

echo "==> 1/3 Aplicando migrations (nome: $MIGRATION_NAME)"
( cd "$API_DIR" && pnpm prisma migrate dev --name "$MIGRATION_NAME" )

# NOTE: there is no separate constraints step any more. CHECKs, composite foreign keys,
# partial indexes, triggers and views live INSIDE the migration files, appended by hand to the
# SQL produced by `prisma migrate dev --create-only`. Applying them from a side file after each
# migration was the original design and it was wrong: objects Prisma models — composite foreign
# keys above all — end up in the database without being in the migration history, and
# `migrate dev` reads that as permanent drift, demanding a full reset on every schema change.

# --- 2. Cities --------------------------------------------------------------
# Reference data, not application seed. Skipped when already loaded.

echo "==> 2/3 Carregando municípios"
"$SEED_DIR/load_cities.sh"

# --- 3. Neighbour distances -------------------------------------------------
# Heavy one-off pass. Skipped when already built.

NEIGHBOURS=$(psql "$PSQL_URL" -tAc "SELECT count(*) FROM city_neighbors")
if [ "$NEIGHBOURS" -gt 0 ]; then
  echo "==> 3/3 Vizinhança já calculada ($NEIGHBOURS pares) — pulando"
else
  echo "==> 3/3 Calculando distâncias entre municípios (demora alguns minutos)"
  psql "$PSQL_URL" -v ON_ERROR_STOP=1 -f "$SEED_DIR/build_city_neighbors.sql"
fi

echo
echo "Banco local pronto. A API pode subir."
psql "$PSQL_URL" -c "
  SELECT 'cidades' AS tabela, count(*) FROM cities
  UNION ALL SELECT 'pares de vizinhança', count(*) FROM city_neighbors;"
