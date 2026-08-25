import type { NearbyRadiusKm } from "./city";
import type { JobRole } from "./job";
import type { AttendanceSummary } from "./attendance";

export type WorkerStatus = "incomplete" | "complete" | "self_deactivated";

export interface Worker {
  id: string;
  fullName: string;
  phone: string; // E.164
  phoneVerifiedAt: string | null; // verificado via WhatsApp — ver §11
  cpf: string; // armazenado; NUNCA em resposta pública
  birthDate: string; // bloquear < 18 anos (ECA Digital)
  cityId: string; // onde mora
  neighborhood: string; // só faz sentido dentro da cidade acima
  // De onde ele QUER receber aviso. Coisa diferente de `cityId`, e o teto
  // de 5 existe para proteger a permissão de notificar (§7.3).
  notificationCityIds: string[];
  // null = desligado, que é o padrão. Ancorado só em `cityId`: uma âncora,
  // um raio — cinco cidades com 50 km cada viraria meio estado.
  nearbyRadiusKm: NearbyRadiusKm | null;
  roles: JobRole[]; // máximo 5
  experience: string;
  availability: Availability[];
  documentSelfieKey: string | null; // chave no MinIO, bucket privado
  // 30s, bucket público. OPCIONAL: quem não grava conclui o cadastro e recebe
  // vaga do mesmo jeito — só não ganha o selo de perfil completo (§16.1).
  introVideoKey: string | null;
  status: WorkerStatus;
  // Prova do consentimento. Termo novo = nova versão = novo aceite.
  termsVersion: string;
  termsAcceptedAt: string;
  termsAcceptedIp: string;
  // Preenchido quando tudo está lá, inclusive o vídeo. É ele — e não `status`
  // — que decide o selo de perfil completo.
  profileCompletedAt: string | null;
  attendance: AttendanceSummary;
  createdAt: string;
}

export interface Availability {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  period: "morning" | "afternoon" | "night";
}

// O que a empresa enxerga na lista pública de candidatos. Sem CPF, sem data
// de nascimento.
export interface WorkerPublicProfile {
  id: string;
  firstName: string;
  lastNameInitial: string;
  // Junto com o bairro: bairro sozinho não diz nada quando a pessoa é de
  // outra cidade.
  cityName: string;
  neighborhood: string;
  roles: JobRole[]; // máximo 5
  experience: string;
  introVideoUrl: string | null;
  introVideoPosterUrl: string | null; // primeiro quadro, gerado no upload
  hasCompleteProfile: boolean; // vem de `profileCompletedAt`, não de `status`
  attendance: AttendanceSummary;
  memberSince: string;
}

/**
 * O que a empresa daquela vaga enxerga do candidato dela (§16.5): o perfil
 * público mais nome completo e disponibilidade. Servido só para a empresa
 * dona da vaga, e só enquanto houver candidatura ativa. Nunca carrega cpf nem
 * birthDate — é o que separa este tipo do `Worker`.
 */
export interface WorkerApplicantProfile extends WorkerPublicProfile {
  fullName: string;
  availability: Availability[];
}
