#!/usr/bin/env bash
# Extraqui — infra/db-deploy-prod.sh
#
# Applies pending migrations to PRODUCTION, in the right order, with a backup first.
# Run by hand on the VPS. Never from a deploy pipeline, never on container start.
#
#     ./infra/db-deploy-prod.sh
#
# Why by hand: one developer, one server, no CI, real data from real people, and a backup
# routine that has not been restored even once yet. A bad migration running by itself at 2am
# has no undo. The thirty seconds of typing are the cheapest insurance in this project.
#
# What IS automated here is the ORDER — backup, migrate, constraints — because forgetting
# constraints.sql is the realistic mistake: the database keeps accepting writes, it just
# stopped protecting.

set -euo pipefail

cd "$(dirname "$0")/.."

API_DIR="apps/api"
SQL_DIR="infra/sql"
SEED_DIR="infra/seed"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
PG_CONTAINER="${PG_CONTAINER:-extra-postgres}"

: "${DATABASE_URL:?DATABASE_URL não está definida.}"

# libpq refuses Prisma-only query params such as ?schema=public. Prisma needs them, libpq
# rejects them — the same URL cannot serve both, so the script adapts.
PSQL_URL="${DATABASE_URL%%\?*}"
export PSQL_URL

# --- Safety belt ------------------------------------------------------------

if grep -Eq '@(localhost|127\.0\.0\.1)[:/]' <<<"$DATABASE_URL"; then
  echo "ABORTADO: DATABASE_URL aponta para localhost."
  echo "Este é o script de PRODUÇÃO. Para o banco local use infra/db-setup-local.sh."
  exit 1
fi

echo "Você está prestes a migrar o banco de PRODUÇÃO."
read -r -p "Digite MIGRAR para continuar: " CONFIRM
[ "$CONFIRM" = "MIGRAR" ] || { echo "Cancelado."; exit 1; }

# --- 1. Backup, and verify it is not empty ----------------------------------
# A backup that was never checked is not a backup. This at least confirms bytes came out.

STAMP=$(date +%F-%H%M%S)
DUMP="$BACKUP_DIR/extra-pre-migration-$STAMP.sql.gz"

echo "==> 1/3 Backup em $DUMP"
mkdir -p "$BACKUP_DIR"
docker exec "$PG_CONTAINER" pg_dump -U extra extra | gzip > "$DUMP"

SIZE=$(stat -c%s "$DUMP")
if [ "$SIZE" -lt 1000 ]; then
  echo "ABORTADO: o backup saiu com $SIZE bytes. Algo está errado — não vou migrar em cima disso."
  exit 1
fi
echo "    backup ok ($SIZE bytes)"

# --- 2. Migrations ----------------------------------------------------------
# `migrate deploy`, never `migrate dev`. deploy só aplica o que falta e nunca reseta.

echo "==> 2/3 Aplicando migrations pendentes"
( cd "$API_DIR" && pnpm prisma migrate deploy )

# --- 3. Constraints ---------------------------------------------------------

echo "==> 3/3 Reaplicando constraints, triggers e views"
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -f "$SQL_DIR/constraints.sql"

# --- Reference data, first run only -----------------------------------------

CITIES=$(psql "$PSQL_URL" -tAc "SELECT count(*) FROM cities")
if [ "$CITIES" -eq 0 ]; then
  echo "==> Primeira execução: carregando municípios e calculando vizinhança"
  "$SEED_DIR/load_cities.sh"
  psql "$PSQL_URL" -v ON_ERROR_STOP=1 -f "$SEED_DIR/build_city_neighbors.sql"
fi

echo
echo "Migração concluída. Backup em $DUMP"
