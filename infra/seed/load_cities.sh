#!/usr/bin/env bash
# Extraqui — infra/seed/load_cities.sh
#
# Loads the IBGE municipality list into `cities`. Reference data, not application seed: it runs
# in production too. Idempotent — does nothing when the table is already populated.
#
# Source: github.com/kelvins/municipios-brasileiros (IBGE code, name, lat/lng, UF code).
# Downloaded once into infra/seed/ and COMMITTED to the repo, so a deploy never depends on a
# third-party repository being online.

set -euo pipefail

cd "$(dirname "$0")"

: "${DATABASE_URL:?DATABASE_URL não está definida.}"

# libpq refuses Prisma-only query params such as ?schema=public. Inherited from the caller
# when run by db-setup-local.sh / db-deploy-prod.sh; derived here when run on its own.
PSQL_URL="${PSQL_URL:-${DATABASE_URL%%\?*}}"

BASE_URL="https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv"

EXISTING=$(psql "$PSQL_URL" -tAc "SELECT count(*) FROM cities")
if [ "$EXISTING" -gt 0 ]; then
  echo "    cidades já carregadas ($EXISTING) — pulando"
  exit 0
fi

# --- The CSVs must be in the repo. This script never downloads --------------
# Fetching at runtime would make a production deploy depend on a third-party
# repository being online at that exact moment. Fetch once, commit, forget.

for f in municipios.csv estados.csv; do
  if [ ! -f "$f" ]; then
    echo "ABORTADO: infra/seed/$f não existe."
    echo
    echo "Baixe uma vez e comite — deploy não pode depender de repositório de terceiro:"
    echo "  curl -fsSL $BASE_URL/municipios.csv -o infra/seed/municipios.csv"
    echo "  curl -fsSL $BASE_URL/estados.csv    -o infra/seed/estados.csv"
    echo "  git add infra/seed/*.csv && git commit -m 'chore: seed de municipios do IBGE'"
    exit 1
  fi
done

# --- Assert the format before trusting it -----------------------------------
# The dataset is third-party. If a column is added or reordered upstream, fail loudly here
# instead of silently loading longitude into latitude.

EXPECTED_MUN="codigo_ibge,nome,latitude,longitude,capital,codigo_uf,siafi_id,ddd,fuso_horario"
EXPECTED_UF="codigo_uf,uf,nome,latitude,longitude,regiao"

# estados.csv ships with a UTF-8 BOM (EF BB BF) before the first column name. Strip it as a
# PREFIX only — `tr -d` would delete those bytes anywhere in the line, and 0xBF is a valid
# continuation byte inside accented characters.
BOM=$'\xEF\xBB\xBF'

read_header() {
  local line
  line=$(head -n1 "$1" | tr -d '\r')
  printf '%s' "${line#"$BOM"}"
}

# The failure mode this guards against: a BOM does not print, so "expected" and "got" come out
# looking IDENTICAL on screen while the comparison fails. Always show the byte count too.
fail_header() {
  echo "ABORTADO: $1 mudou de formato."
  echo "  esperado: $2   (${#2} bytes)"
  echo "  veio:     $3   (${#3} bytes)"
  echo
  echo "  Se os dois parecem iguais, a diferença é byte invisível. Confira com:"
  echo "    head -n1 $1 | xxd | head -3"
  exit 1
}

ACTUAL_MUN=$(read_header municipios.csv)
ACTUAL_UF=$(read_header estados.csv)

[ "$ACTUAL_MUN" = "$EXPECTED_MUN" ] || fail_header municipios.csv "$EXPECTED_MUN" "$ACTUAL_MUN"
[ "$ACTUAL_UF"  = "$EXPECTED_UF"  ] || fail_header estados.csv    "$EXPECTED_UF"  "$ACTUAL_UF"

# --- Load -------------------------------------------------------------------

psql "$PSQL_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

CREATE TEMP TABLE stg_mun (
  codigo_ibge   text,
  nome          text,
  latitude      text,
  longitude     text,
  capital       text,
  codigo_uf     text,
  siafi_id      text,
  ddd           text,
  fuso_horario  text
);

CREATE TEMP TABLE stg_uf (
  codigo_uf text,
  uf        text,
  nome      text,
  latitude  text,
  longitude text,
  regiao    text
);

\copy stg_mun FROM 'municipios.csv' WITH (FORMAT csv, HEADER true)
\copy stg_uf  FROM 'estados.csv'    WITH (FORMAT csv, HEADER true)

-- Slug carries the UF because municipality names repeat across states, and the slug is the
-- indexed URL. Accents are folded with translate() instead of the unaccent extension: one less
-- thing that has to exist in the production container.
INSERT INTO cities (id, name, uf, slug, lat, lng)
SELECT
  m.codigo_ibge,
  m.nome,
  u.uf,
  trim(BOTH '-' FROM
    regexp_replace(
      lower(translate(
        m.nome,
        'áàâãäéèêëíìîïóòôõöúùûüñçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÑÇ',
        'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
      )),
      '[^a-z0-9]+', '-', 'g'
    )
  ) || '-' || lower(u.uf),
  m.latitude::numeric(9,6),
  m.longitude::numeric(9,6)
FROM stg_mun m
JOIN stg_uf  u ON u.codigo_uf = m.codigo_uf;

COMMIT;
SQL

psql "$PSQL_URL" -tAc "SELECT '    ' || count(*) || ' municípios carregados' FROM cities"
