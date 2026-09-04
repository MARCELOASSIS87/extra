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

/**
 * A MESMA regra do §16.2, na direção contrária: dado um trabalhador, quais
 * vagas o alcançam. É o feed dele (`GET /v1/me/jobs`).
 *
 * Vive neste arquivo, coladinha na de cima, porque as duas TÊM que concordar:
 * se discordarem, o feed mostra vaga que nunca vai notificar, ou o push chega
 * de vaga que não está na lista — e as duas fazem a pessoa concluir que o site
 * está quebrado. Um teste de simetria trava esse par (`symmetry.test.ts`).
 *
 * Os cinco predicados são os mesmos, na mesma ordem: função, disponibilidade,
 * cidade assinada OU raio, e o alcance da empresa filtrando só quem chega
 * pelo raio. O que muda é de que lado vem a constante.
 *
 * O dia e o período saem do `starts_at` de CADA vaga, e por isso são
 * calculados no SQL — `AT TIME ZONE 'America/Sao_Paulo'`, os mesmos cortes de
 * `jobAvailabilitySlot` (manhã < 12h, tarde < 18h, noite o resto). É a única
 * duplicação da regra, e é inevitável: do outro lado a vaga é uma só e o slot
 * cabe em TypeScript; aqui são N vagas por consulta, e trazer todas para
 * filtrar em memória seria ler a tabela inteira. O teste de simetria é o que
 * garante que os dois cortes continuam dando a mesma resposta.
 */
export async function routedJobIdsForWorker(
  workerId: string,
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT j.id
      FROM job_posts j
      JOIN workers w
        ON w.id = ${workerId}::uuid AND w.status = 'complete'
      JOIN worker_roles wr
        ON wr.worker_id = w.id AND wr.role = j.role
      JOIN worker_availability wa
        ON wa.worker_id = w.id
       AND wa.weekday = EXTRACT(
             DOW FROM j.starts_at AT TIME ZONE 'America/Sao_Paulo'
           )::int
       AND wa.period = (
             CASE
               WHEN EXTRACT(
                      HOUR FROM j.starts_at AT TIME ZONE 'America/Sao_Paulo'
                    ) < 12 THEN 'morning'
               WHEN EXTRACT(
                      HOUR FROM j.starts_at AT TIME ZONE 'America/Sao_Paulo'
                    ) < 18 THEN 'afternoon'
               ELSE 'night'
             END
           )::"AvailabilityPeriod"
      LEFT JOIN worker_notification_cities wnc
        ON wnc.worker_id = w.id AND wnc.city_id = j.city_id
      LEFT JOIN city_neighbors cn
        ON cn.city_id = w.city_id
       AND cn.neighbor_city_id = j.city_id
       AND cn.distance_km <= w.nearby_radius_km
     WHERE j.status = 'open'
       AND j.expires_at > now()
       AND (
             wnc.city_id IS NOT NULL
             OR (
               cn.neighbor_city_id IS NOT NULL
               AND (
                     j.reach = 'unrestricted'
                  OR (j.reach = 'city_only' AND w.city_id = j.city_id)
                  OR (j.reach = 'nearby'
                      AND cn.distance_km <= COALESCE(j.reach_radius_km, 0))
               )
             )
           )`;

  return rows.map((row) => row.id);
}
