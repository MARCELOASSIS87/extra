"use client";

import type { NearbyRadiusKm } from "@extra/shared/types/city";
import { MAX_NOTIFICATION_CITIES } from "@extra/shared/schemas/city";
import { citiesWithinRadius, cityLabel, listCities } from "@/lib/api/cities";

const NEARBY_RADIUS_OPTIONS = [25, 50] as const satisfies NearbyRadiusKm[];

const labelClass = "text-sm font-medium";

/**
 * De onde a pessoa quer receber aviso, e o raio opcional em torno de onde ela
 * mora (§7.3, §16.2). Campo controlado, sem react-hook-form por dentro, para
 * servir tanto ao cadastro quanto à tela de perfil.
 *
 * Duas coisas que o texto precisa deixar claras, porque são a diferença entre
 * a pessoa entender o produto e achar que ele está quebrado:
 * o aviso é limitado às cidades escolhidas, mas **candidatar-se não é** — a
 * listagem mostra qualquer cidade. E o número de cidades que o raio inclui
 * aparece **antes** de ligar, não depois: ninguém aceita o que não viu.
 */
export function NotificationCitiesField({
  cityIds,
  nearbyRadiusKm,
  homeCityId,
  onChange,
  error,
}: {
  cityIds: string[];
  nearbyRadiusKm: NearbyRadiusKm | null;
  /** Cidade onde mora: âncora do raio, e a que já vem marcada. */
  homeCityId: string;
  onChange: (next: {
    cityIds: string[];
    nearbyRadiusKm: NearbyRadiusKm | null;
  }) => void;
  error?: string;
}) {
  const atLimit = cityIds.length >= MAX_NOTIFICATION_CITIES;

  const toggleCity = (id: string) =>
    onChange({
      nearbyRadiusKm,
      cityIds: cityIds.includes(id)
        ? cityIds.filter((current) => current !== id)
        : [...cityIds, id],
    });

  return (
    <fieldset className="grid gap-3">
      <legend className={labelClass}>
        De quais cidades você quer receber aviso?
      </legend>
      <p className="text-muted-foreground text-xs">
        De 1 a {MAX_NOTIFICATION_CITIES} cidades. Isso vale só para o aviso —
        você continua podendo se candidatar a vaga de qualquer cidade.
      </p>

      <ul className="grid gap-2">
        {listCities().map((city) => {
          const checked = cityIds.includes(city.id);
          return (
            <li key={city.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && atLimit}
                  onChange={() => toggleCity(city.id)}
                  className="border-input size-4 shrink-0 rounded disabled:opacity-40"
                />
                <span className={!checked && atLimit ? "opacity-40" : ""}>
                  {city.name} — {city.uf}
                  {city.id === homeCityId && (
                    <span className="text-muted-foreground">
                      {" "}
                      (onde você mora)
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {atLimit && (
        <p className="text-muted-foreground text-xs">
          Você chegou às {MAX_NOTIFICATION_CITIES} cidades. Desmarque uma para
          escolher outra.
        </p>
      )}

      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}

      <NearbyRadiusChoice
        homeCityId={homeCityId}
        value={nearbyRadiusKm}
        onChange={(next) => onChange({ cityIds, nearbyRadiusKm: next })}
      />
    </fieldset>
  );
}

function NearbyRadiusChoice({
  homeCityId,
  value,
  onChange,
}: {
  homeCityId: string;
  value: NearbyRadiusKm | null;
  onChange: (value: NearbyRadiusKm | null) => void;
}) {
  // O custo antes da escolha: quantas cidades cada raio inclui, contado na
  // tabela de vizinhança, exibido com o interruptor ainda desligado.
  const counts = NEARBY_RADIUS_OPTIONS.map((km) => ({
    km,
    total: citiesWithinRadius(homeCityId, km).length,
  }));

  return (
    <div className="mt-1 grid gap-2 border-t pt-3">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={value !== null}
          onChange={(event) => onChange(event.target.checked ? 25 : null)}
          className="border-input mt-0.5 size-4 shrink-0 rounded"
        />
        <span>Receber também vagas de cidades vizinhas</span>
      </label>

      <p className="text-muted-foreground text-xs">
        A partir de {cityLabel(homeCityId)}:{" "}
        {counts
          .map(({ km, total }) => `${km} km inclui ${total} cidades`)
          .join(", ")}
        . A distância é entre os centros dos municípios.
      </p>

      {value !== null && (
        <div className="flex flex-wrap gap-2">
          {counts.map(({ km, total }) => (
            <label
              key={km}
              className="has-checked:border-primary has-checked:bg-secondary flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <input
                type="radio"
                name="nearby-radius"
                checked={value === km}
                onChange={() => onChange(km)}
                className="size-4 shrink-0"
              />
              <span>
                Até {km} km
                <span className="text-muted-foreground">
                  {" "}
                  · {total} cidades
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
