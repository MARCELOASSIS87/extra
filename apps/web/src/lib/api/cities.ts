import type { City } from "@extra/shared/types/city";
import { cities, cityNeighbors, DEFAULT_CITY_ID } from "@/mocks/cities";

/**
 * Cidade é dado de referência: não muda, não expira e não vale simular
 * latência nem falha em cima dela. Por isso este módulo é síncrono e não
 * devolve `ApiResult` — quem consome é tela, que precisa do nome na hora de
 * renderizar o bairro ao lado da cidade.
 *
 * ponytail: a lista inteira vem do bundle, hoje com 13 cidades. Vira busca
 * remota se um dia as 5.571 do IBGE precisarem estar todas disponíveis.
 */
const byId = new Map(cities.map((city) => [city.id, city]));

export { DEFAULT_CITY_ID };

export function cityName(cityId: string): string {
  return byId.get(cityId)?.name ?? "";
}

/** O slug que a URL do detalhe carrega: /vagas/[cidade]/[slug]. */
export function citySlug(cityId: string): string {
  return byId.get(cityId)?.slug ?? "";
}

/** "Poços de Caldas — MG". Nome de município se repete entre estados. */
export function cityLabel(cityId: string): string {
  const city = byId.get(cityId);
  return city ? `${city.name} — ${city.uf}` : "";
}

/** Em ordem alfabética, para o seletor e para a lista de cidades de aviso. */
export function listCities(): City[] {
  return [...cities].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/**
 * Distância entre os centros de dois municípios, em km. `null` quando o par
 * não está na tabela de vizinhança — ela só guarda até 100 km, e mais que
 * isso não é "vizinho" para efeito nenhum deste produto.
 */
export function cityDistanceKm(
  fromCityId: string,
  toCityId: string,
): number | null {
  const pair = cityNeighbors.find(
    (item) => item.cityId === fromCityId && item.neighborCityId === toCityId,
  );
  return pair?.distanceKm ?? null;
}

/**
 * Cidades a até `radiusKm` de `cityId`, da mais perto para a mais longe. A
 * própria cidade entra (o par consigo mesma existe, com 0 km), então o
 * "50 km inclui 23 cidades" da tela sai daqui direto, sem ramo especial.
 *
 * A distância é entre centros de município — aproximação, e a interface
 * escreve "cerca de", nunca um número exato.
 */
export function citiesWithinRadius(cityId: string, radiusKm: number): City[] {
  return cityNeighbors
    .filter((pair) => pair.cityId === cityId && pair.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .flatMap((pair) => {
      const city = byId.get(pair.neighborCityId);
      return city ? [city] : [];
    });
}
