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

BASE_URL="https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv"

EXISTING=$(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM cities")
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

ACTUAL_MUN=$(head -n1 municipios.csv | tr -d '\r')
ACTUAL_UF=$(head -n1 estados.csv | tr -d '\r')

if [ "$ACTUAL_MUN" != "$EXPECTED_MUN" ]; then
  echo "ABORTADO: municipios.csv mudou de formato."
  echo "  esperado: $EXPECTED_MUN"
  echo "  veio:     $ACTUAL_MUN"
  exit 1
fi

if [ "$ACTUAL_UF" != "$EXPECTED_UF" ]; then
  echo "ABORTADO: estados.csv mudou de formato."
  echo "  esperado: $EXPECTED_UF"
  echo "  veio:     $ACTUAL_UF"
  exit 1
fi

# --- Load -------------------------------------------------------------------

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
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

psql "$DATABASE_URL" -tAc "SELECT '    ' || count(*) || ' municípios carregados' FROM cities"
