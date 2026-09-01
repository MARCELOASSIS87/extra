import type { FastifyInstance } from "fastify";
import {
  CITY_SEARCH_LIMIT,
  citySearchQuerySchema,
} from "@extra/shared/schemas/city";
import type { City } from "@extra/shared/types/city";
import { prisma } from "../db.js";
import { success } from "../http.js";
import { publicReadRateLimit } from "../rate-limit.js";

/**
 * O termo digitado vira slug e a busca acontece contra `cities.slug`, que já
 * nasce sem acento e em minúsculas. É o que dá busca insensível a acento e a
 * caixa sem `unaccent` — extensão que precisaria entrar por migration só para
 * refazer o que o slug já resolve.
 *
 * TODO: `contains` faz varredura em 5.571 linhas, o que é ~1ms. Vira
 * índice `pg_trgm` no dia em que a tabela crescer, o que não vai acontecer.
 */
const toSearchSlug = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function registerCityRoutes(app: FastifyInstance): void {
  /**
   * Alimenta o select de cidade (§8). Sempre limitada: devolver os 5.571
   * municípios num app em 4G é o mesmo que não responder.
   */
  app.get(
    "/v1/cities",
    { onRequest: publicReadRateLimit },
    async (request, reply) => {
      const { uf, q } = citySearchQuerySchema.parse(request.query);
      const term = q ? toSearchSlug(q) : "";

      const rows = await prisma.city.findMany({
        where: {
          ...(uf ? { uf } : {}),
          ...(term ? { slug: { contains: term } } : {}),
        },
        orderBy: [{ name: "asc" }, { uf: "asc" }],
        take: CITY_SEARCH_LIMIT,
      });

      const cities: City[] = rows.map((city) => ({
        id: city.id,
        name: city.name,
        uf: city.uf,
        slug: city.slug,
        lat: city.lat.toNumber(),
        lng: city.lng.toNumber(),
      }));

      return reply.send(success(cities));
    },
  );
}
