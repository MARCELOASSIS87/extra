export type JobRole =
  | "garcom"
  | "cozinheiro"
  | "auxiliar_cozinha"
  | "auxiliar_limpeza"
  | "diarista"
  | "barman"
  | "seguranca"
  | "recepcionista"
  | "montagem_evento"
  | "motorista"
  | "outro";

export type JobStatus = "open" | "filled" | "expired" | "cancelled";

export interface JobPost {
  id: string;
  slug: string;
  companyId: string;
  role: JobRole;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  payAmount: number; // INFORMATIVO. Não processamos este valor.
  payNote: string | null;
  address: string;
  neighborhood: string;
  city: string;
  requirements: string | null; // uniforme etc — exigência DA EMPRESA
  vacancies: number;
  contactPhone: string;
  status: JobStatus;
  isHighlighted: boolean;
  publishedAt: string;
  expiresAt: string;
}
