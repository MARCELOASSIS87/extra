import { cities, DEFAULT_CITY_ID } from "@/mocks/cities";

/**
 * Cidade é dado de referência: não muda, não expira e não vale simular
 * latência nem falha em cima dela. Por isso este módulo é síncrono e não
 * devolve `ApiResult` — quem consome é tela, que precisa do nome na hora de
 * renderizar o bairro ao lado da cidade.
 *
 * ponytail: a lista inteira vem do bundle, hoje com 13 cidades. Vira busca
 * remota se um dia as 5.571 do IBGE precisarem estar todas disponíveis.
 */
const byId = new Map(cities.map((city) => [city.id, city.name]));

export { DEFAULT_CITY_ID };

export function cityName(cityId: string): string {
  return byId.get(cityId) ?? "";
}
