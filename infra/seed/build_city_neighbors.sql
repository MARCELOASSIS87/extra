-- Extraqui — infra/seed/build_city_neighbors.sql
--
-- Builds city_neighbors from cities.lat/lng. Run ONCE after loading infra/seed/cities.csv,
-- and again only if the city list itself changes (it does not — municipalities do not move).
--
--     psql "$DATABASE_URL" -f infra/seed/build_city_neighbors.sql
--
-- This is NOT part of constraints.sql on purpose: constraints.sql runs after every migration
-- and must stay cheap. This one does a heavy pass and writes hundreds of thousands of rows.
--
-- Runtime: a few minutes on a small VPS. It is a full pairwise pass over ~5.570 municipalities
-- (about 15 million combinations) filtered down to the pairs within 100 km. Run it with the
-- API stopped, or accept that the box will be busy for a while.

BEGIN;

TRUNCATE city_neighbors;

-- Haversine, in kilometres, mean Earth radius 6371 km.
-- The bounding-box filter in the WHERE clause is what makes this finish: it discards almost
-- every pair with plain arithmetic before any trigonometry runs. One degree of latitude is
-- ~111 km, so 1.0 degree comfortably covers the 100 km cut-off in both directions.
INSERT INTO city_neighbors (city_id, neighbor_city_id, distance_km)
SELECT
  a.id,
  b.id,
  round(
    6371 * 2 * asin(
      sqrt(
        power(sin(radians(b.lat - a.lat) / 2), 2)
        + cos(radians(a.lat)) * cos(radians(b.lat))
        * power(sin(radians(b.lng - a.lng) / 2), 2)
      )
    )
  )::smallint AS distance_km
FROM cities a
JOIN cities b
  ON abs(b.lat - a.lat) <= 1.0
 AND abs(b.lng - a.lng) <= 1.0
WHERE 6371 * 2 * asin(
        sqrt(
          power(sin(radians(b.lat - a.lat) / 2), 2)
          + cos(radians(a.lat)) * cos(radians(b.lat))
          * power(sin(radians(b.lng - a.lng) / 2), 2)
        )
      ) <= 100;

-- The self-pair (X, X, 0) comes out of the join above for free, and it is wanted: it lets a
-- worker's own city fall inside any radius with no special case in the routing query.

ANALYZE city_neighbors;

COMMIT;

-- Sanity check after running — expect a few hundred thousand rows, and every city present:
--   SELECT count(*) FROM city_neighbors;
--   SELECT count(*) FROM cities c
--    WHERE NOT EXISTS (SELECT 1 FROM city_neighbors n WHERE n.city_id = c.id);  -- must be 0
