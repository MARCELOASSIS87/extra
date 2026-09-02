import type { FastifyInstance } from "fastify";
import {
  CITY_SEARCH_LIMIT,
  citySearchQuerySchema,
} from "@extra/shared/schemas/city";
import { cityNeighborsQuerySchema } from "@extra/shared/schemas/worker";
import type { City, CityNeighbor } from "@extra/shared/types/city";
import { prisma } from "../db.js";
import { failure, success } from "../http.js";
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

  /**
   * Quantas e quais cidades o raio inclui — o "50 km inclui 23 cidades" que a
   * tela mostra ANTES de a pessoa ligar o aviso por vizinhança (§7.3). Ela tem
   * direito de ver o que está aceitando.
   *
   * Pública, com o mesmo rate limit das outras: isto é distância entre centros
   * de município, dado de referência calculado uma vez a partir do IBGE. Não é
   * dado de ninguém, e não há o que autorizar.
   *
   * O par (X, X) existe na tabela com 0 km, então a própria cidade entra na
   * conta sem nenhum ramo especial.
   */
  app.get<{ Params: { id: string }; Querystring: { radiusKm?: string } }>(
    "/v1/cities/:id/neighbors",
    { onRequest: publicReadRateLimit },
    async (request, reply) => {
      const parsed = cityNeighborsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return reply
          .status(400)
          .send(failure("validation_error", issue.message, "radiusKm"));
      }

      // Cidade inexistente é 404, nunca lista vazia: vazio faria a tela dizer
      // "0 cidades" para um id errado, e ninguém descobriria o porquê.
      const city = await prisma.city.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      });
      if (!city) {
        return reply
          .status(404)
          .send(failure("city_not_found", "Cidade não encontrada."));
      }

      const rows = await prisma.cityNeighbor.findMany({
        where: { cityId: city.id, distanceKm: { lte: parsed.data.radiusKm } },
        orderBy: { distanceKm: "asc" },
        select: {
          distanceKm: true,
          neighbor: { select: { id: true, name: true, uf: true, slug: true } },
        },
      });

      const neighbors: (CityNeighbor & {
        name: string;
        uf: string;
        slug: string;
      })[] = rows.map((row) => ({
        cityId: city.id,
        neighborCityId: row.neighbor.id,
        distanceKm: row.distanceKm,
        name: row.neighbor.name,
        uf: row.neighbor.uf,
        slug: row.neighbor.slug,
      }));

      return reply.send(success({ total: neighbors.length, neighbors }));
    },
  );
}
