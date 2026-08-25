/**
 * Cidade é entidade, nunca texto livre (§7.1). Cidade digitada vira "Poços de
 * Caldas", "Pocos de Caldas" e "POÇOS" no mesmo banco — quatro cidades para o
 * Postgres, e o roteamento passa a errar em silêncio.
 */
export interface City {
  id: string; // código IBGE, 7 dígitos. Chave natural, estável, canônica
  name: string;
  uf: string;
  slug: string; // ÚNICO. Carrega a UF porque nome de município se repete
  lat: number;
  lng: number;
}

/**
 * Vizinhança é tabela calculada, não conta feita na hora: pares até 100 km,
 * gerados uma vez a partir de lat/lng. A distância é entre os centros dos
 * municípios — aproximação, e a interface trata como tal ("cerca de 24 km").
 */
export interface CityNeighbor {
  cityId: string;
  neighborCityId: string;
  distanceKm: number;
}

/** Raio em torno de `Worker.cityId`. Valores fechados, nunca campo livre (§7.3). */
export type NearbyRadiusKm = 25 | 50;
