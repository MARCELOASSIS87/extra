import type { AttendanceSummary } from "@extra/shared/types/attendance";
import type { JobRole } from "@extra/shared/types/job";
import type {
  Availability,
  WorkerApplicantProfile,
  WorkerPublicProfile,
} from "@extra/shared/types/worker";
import { prisma } from "./db.js";

/**
 * Monta os perfis que a EMPRESA enxerga, em lote, para as quatro telas do
 * painel. Existe para haver um lugar só onde esse recorte é feito: o perfil
 * sai da view `worker_public_profiles`, nunca da tabela `workers` — a view
 * não alcança `accounts`, e é por isso que telefone não vaza daqui nem por
 * engano (§16.5, regra 8). CPF e data de nascimento também não existem nela.
 *
 * Em lote e não dentro de laço: cinco leituras de tamanho fixo, independente
 * de quantos candidatos voltem.
 */

const emptySummary: AttendanceSummary = {
  present: 0,
  absent: 0,
  distinctCompanies: 0,
  // Quem decide "Novo por aqui" é o servidor; a interface nunca interpreta um
  // zero (§16.6, regra 7).
  hasHistory: false,
};

interface ProfileRow {
  id: string;
  first_name: string;
  last_name_initial: string;
  city_name: string;
  neighborhood: string;
  experience: string;
  intro_video_key: string | null;
  has_complete_profile: boolean;
  member_since: Date;
}

export interface LoadedProfiles {
  /** O perfil público, para as listas que não precisam do nome completo. */
  publicById: Map<string, WorkerPublicProfile>;
  /**
   * O perfil de candidato: o público mais disponibilidade, e o nome completo
   * só para quem a empresa já chamou (§16.5). Continua sem CPF, sem data de
   * nascimento e sem telefone.
   */
  applicantById: Map<string, WorkerApplicantProfile>;
  /** Distância entre o município do trabalhador e o da vaga, quando pedida. */
  distanceById: Map<string, number>;
}

export async function loadWorkerProfiles(
  workerIds: string[],
  /** Cidade da vaga, quando a tela mostra distância. */
  jobCityId?: string,
  /**
   * A empresa que está lendo. Só com ela dá para saber quem ela JÁ chamou —
   * e é isso que abre o nome completo (§16.5, regra 8). Ausente, ninguém foi
   * contatado do ponto de vista desta leitura, e todo `fullName` sai `null`:
   * o padrão é o fechado, para uma tela nova não nascer vazando.
   */
  companyId?: string,
): Promise<LoadedProfiles> {
  if (workerIds.length === 0) {
    return {
      publicById: new Map(),
      applicantById: new Map(),
      distanceById: new Map(),
    };
  }

  const [profiles, summaries, roles, availability, neighbors, contacted] =
    await Promise.all([
      prisma.$queryRaw<ProfileRow[]>`
        SELECT * FROM worker_public_profiles WHERE id = ANY(${workerIds}::uuid[])`,
      prisma.$queryRaw<
        {
          worker_id: string;
          present: bigint;
          absent: bigint;
          distinct_companies: bigint;
          has_history: boolean;
        }[]
      >`SELECT * FROM worker_attendance_summary WHERE worker_id = ANY(${workerIds}::uuid[])`,
      prisma.workerRole.findMany({
        where: { workerId: { in: workerIds } },
        select: { workerId: true, role: true },
      }),
      prisma.workerAvailability.findMany({
        where: { workerId: { in: workerIds } },
        select: { workerId: true, weekday: true, period: true },
      }),
      jobCityId
        ? prisma.$queryRaw<{ worker_id: string; distance_km: number }[]>`
            SELECT w.id AS worker_id, cn.distance_km
              FROM workers w
              JOIN city_neighbors cn
                ON cn.city_id = w.city_id AND cn.neighbor_city_id = ${jobCityId}
             WHERE w.id = ANY(${workerIds}::uuid[])`
        : Promise.resolve([]),
      // Quem ESTA empresa já chamou. `contactedAt` é o registro do ato de
      // escolher, e é ele — não a tela — que decide se o nome completo sai.
      companyId
        ? prisma.application.findMany({
            where: {
              workerId: { in: workerIds },
              contactedAt: { not: null },
              jobPost: { companyId },
            },
            select: { workerId: true },
          })
        : Promise.resolve([]),
    ]);

  const contactedIds = [
    ...new Set(contacted.flatMap((row) => (row.workerId ? [row.workerId] : []))),
  ];

  /**
   * O nome completo é o único campo que não vem da view, e é lido SÓ para
   * quem a empresa já chamou — não se lê o que não se vai servir. Segunda
   * ida ao banco de propósito: depende de `contacted`, e uma consulta que
   * traz o nome de todos "por via das dúvidas" é a que vaza no dia em que
   * alguém esquecer o corte lá embaixo.
   */
  const names =
    contactedIds.length > 0
      ? await prisma.worker.findMany({
          where: { id: { in: contactedIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];

  const summaryById = new Map(summaries.map((row) => [row.worker_id, row]));
  const nameById = new Map(names.map((row) => [row.id, row]));

  const rolesById = new Map<string, JobRole[]>();
  for (const { workerId, role } of roles) {
    rolesById.set(workerId, [...(rolesById.get(workerId) ?? []), role]);
  }

  const availabilityById = new Map<string, Availability[]>();
  for (const { workerId, weekday, period } of availability) {
    availabilityById.set(workerId, [
      ...(availabilityById.get(workerId) ?? []),
      { weekday: weekday as Availability["weekday"], period },
    ]);
  }

  const publicById = new Map<string, WorkerPublicProfile>();
  const applicantById = new Map<string, WorkerApplicantProfile>();

  for (const profile of profiles) {
    const summary = summaryById.get(profile.id);
    const publicProfile: WorkerPublicProfile = {
      id: profile.id,
      firstName: profile.first_name,
      lastNameInitial: profile.last_name_initial,
      cityName: profile.city_name,
      neighborhood: profile.neighborhood,
      roles: rolesById.get(profile.id) ?? [],
      experience: profile.experience,
      // TODO: a URL assinada do MinIO é a tarefa 25. Até lá, quem tem vídeo
      // aparece com o selo e sem player, em vez de com um link morto.
      introVideoUrl: null,
      introVideoPosterUrl: null,
      hasCompleteProfile: profile.has_complete_profile,
      attendance: summary
        ? {
            present: Number(summary.present),
            absent: Number(summary.absent),
            distinctCompanies: Number(summary.distinct_companies),
            hasHistory: summary.has_history,
          }
        : emptySummary,
      memberSince: profile.member_since.toISOString(),
    };

    publicById.set(profile.id, publicProfile);

    // O portão: sem `contactedAt` daquela empresa, o nome completo nem foi
    // lido. Mesma regra do telefone — a lista mostra primeiro nome e inicial,
    // que vêm da view, e o sobrenome só aparece depois da escolha.
    const name = nameById.get(profile.id);
    applicantById.set(profile.id, {
      ...publicProfile,
      fullName: name ? `${name.firstName} ${name.lastName}` : null,
      availability: availabilityById.get(profile.id) ?? [],
    });
  }

  return {
    publicById,
    applicantById,
    distanceById: new Map(
      neighbors.map((row) => [row.worker_id, row.distance_km]),
    ),
  };
}
