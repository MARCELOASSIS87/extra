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
  city: string;
  neighborhood: string;
  roles: JobRole[];
  experience: string;
  availability: Availability[];
  documentSelfieKey: string | null; // chave no MinIO, bucket privado
  introVideoKey: string | null; // 30s, bucket público
  references: WorkerReference[];
  status: WorkerStatus;
  attendance: AttendanceSummary;
  createdAt: string;
}

export interface WorkerReference {
  name: string;
  phone: string;
  relationship: string;
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
  neighborhood: string;
  roles: JobRole[];
  experience: string;
  introVideoUrl: string | null;
  introVideoPosterUrl: string | null; // primeiro quadro, gerado no upload
  hasCompleteProfile: boolean;
  attendance: AttendanceSummary;
  memberSince: string;
}

/**
 * O que a empresa daquela vaga enxerga do candidato dela (§16.5): o perfil
 * público mais nome completo, disponibilidade e referências. Servido só para
 * a empresa dona da vaga, e só enquanto houver candidatura ativa. Nunca
 * carrega cpf nem birthDate — é o que separa este tipo do `Worker`.
 */
export interface WorkerApplicantProfile extends WorkerPublicProfile {
  fullName: string;
  availability: Availability[];
  references: WorkerReference[];
}
