import { z } from "zod";

/** Máximo de cidades de aviso por trabalhador — protege a permissão de notificar (§7.3). */
export const MAX_NOTIFICATION_CITIES = 5;

/**
 * Código IBGE de 7 dígitos. Cidade sempre chega como id vindo da tabela
 * `cities`; texto digitado não passa por aqui de propósito (§7.1).
 */
export const cityIdSchema = z
  .string()
  .regex(/^\d{7}$/, "Selecione uma cidade da lista");

/** Valores fechados: 25 km, 50 km ou desligado. Nunca campo livre. */
export const nearbyRadiusKmSchema = z
  .union([z.literal(25), z.literal(50)])
  .nullable();

export const notificationCityIdsSchema = z
  .array(cityIdSchema)
  .min(1, "Escolha ao menos uma cidade para receber avisos")
  .max(
    MAX_NOTIFICATION_CITIES,
    `Escolha no máximo ${MAX_NOTIFICATION_CITIES} cidades`,
  );

/** De onde a pessoa quer receber aviso, e o raio em torno de onde ela mora. */
export const workerNotificationPreferencesSchema = z.object({
  notificationCityIds: notificationCityIdsSchema,
  nearbyRadiusKm: nearbyRadiusKmSchema,
});
export type WorkerNotificationPreferences = z.infer<
  typeof workerNotificationPreferencesSchema
>;
