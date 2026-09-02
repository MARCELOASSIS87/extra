import type { JobReach, JobRole } from "@extra/shared/types/job";
import { jobAvailabilitySlot } from "@extra/shared/lib/job";
import { prisma } from "./db.js";

/**
 * O roteamento do §16.2, em UMA query — quem alcança a cidade da vaga, tem a
 * função e tem disponibilidade no dia e período dela.
 *
 * Esta é a única implementação da regra no repositório, e é de propósito: a
 * tela de publicar mostra "34 garçons serão avisados" ANTES de a empresa
 * estreitar, e o disparo do push decide quem recebe. Se as duas contas não
 * saírem da mesma query, a tela mente — a empresa estreita o alcance olhando
 * um número que o push não vai honrar.
 *
 * As duas regras que tornam o filtro da empresa seguro estão no SQL, não em
 * código em volta:
 *
 * 1. **Inscrição explícita sempre passa.** Quem pôs aquela cidade na mão
 *    declarou que trabalha ali — pode morar a 80 km e ir de ônibus. O `reach`
 *    da empresa filtra APENAS quem está chegando pelo raio de vizinhança.
 * 2. **O alcance da empresa só estreita.** O opt-in do trabalhador é o teto:
 *    uma empresa pode pedir 500 km que ninguém fora do opt-in recebe.
 *
 * `city_neighbors` inclui o par (X, X) com distância 0 — é o que faz
 * `city_only` funcionar pelo mesmo caminho, sem ramo especial.
 */
export interface RoutingTarget {
  cityId: string;
  role: JobRole;
  reach: JobReach;
  reachRadiusKm: number | null;
  /**
   * Instante de início da vaga: dele saem o dia da semana e o período.
   * Ausente na tela de publicar antes de a data ser preenchida — aí a
   * disponibilidade não filtra, e o número sai como TETO do alcance.
   */
  startsAt?: string;
}

/**
 * Os ids de quem seria avisado. `SELECT DISTINCT` porque as duas junções de
 * cidade podem casar na mesma pessoa (assinou a cidade E está no raio) — sem
 * ele, quem assinou a própria cidade seria contado duas vezes.
 */
export async function routedWorkerIds(job: RoutingTarget): Promise<string[]> {
  // Sem data ainda: a disponibilidade não entra, e o `-1` não casa com
  // weekday nenhum, então a junção vira "qualquer disponibilidade declarada".
  // O disparo real SEMPRE tem data — este ramo é só da tela de publicar.
  const slot = job.startsAt ? jobAvailabilitySlot(job.startsAt) : null;
  const weekday = slot?.weekday ?? -1;
  const period = slot?.period ?? null;

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT w.id
      FROM workers w
      JOIN worker_roles wr
        ON wr.worker_id = w.id AND wr.role = ${job.role}::"JobRole"
      JOIN worker_availability wa
        ON wa.worker_id = w.id
       AND (${weekday}::int = -1 OR wa.weekday = ${weekday}::int)
       AND (${period}::text IS NULL
            OR wa.period = ${period}::"AvailabilityPeriod")
      LEFT JOIN worker_notification_cities wnc
        ON wnc.worker_id = w.id AND wnc.city_id = ${job.cityId}
      LEFT JOIN city_neighbors cn
        ON cn.city_id = w.city_id
       AND cn.neighbor_city_id = ${job.cityId}
       AND cn.distance_km <= w.nearby_radius_km
     WHERE w.status = 'complete'
       AND (
             wnc.city_id IS NOT NULL
             OR (
               cn.neighbor_city_id IS NOT NULL
               AND (
                     ${job.reach} = 'unrestricted'
                  OR (${job.reach} = 'city_only' AND w.city_id = ${job.cityId})
                  OR (${job.reach} = 'nearby'
                      AND cn.distance_km <= ${job.reachRadiusKm ?? 0})
               )
             )
           )`;

  return rows.map((row) => row.id);
}

/**
 * Quantos seriam avisados. Conta pela mesma query que escolhe — contar por um
 * caminho e disparar por outro é como os dois números divergem sem ninguém
 * perceber.
 *
 * ponytail: conta lendo os ids em vez de um COUNT no banco. A base de
 * trabalhadores por cidade é da ordem de centenas, e a tela de publicar chama
 * isto a cada mudança de alcance; vira `COUNT(DISTINCT w.id)` se algum dia a
 * lista pesar.
 */
export async function countRoutedWorkers(job: RoutingTarget): Promise<number> {
  return (await routedWorkerIds(job)).length;
}
