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

// Filtros da listagem pública — espelham a query de GET /v1/jobs (§8).
export interface JobFilters {
  role?: JobRole;
  city?: string;
  neighborhood?: string;
  date?: string;
  page?: number;
  pageSize?: number;
}

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
  payAmount: number; // real inteiro, sem centavos. INFORMATIVO: não processamos.
  payNote: string | null;
  address: string;
  neighborhood: string;
  city: string;
  requirements: string | null; // uniforme etc — exigência DA EMPRESA
  vacancies: number;
  applicationsCount: number; // exibido no card; substitui o contato
  maxApplications: number; // vacancies * 3 — ver §16.5
  status: JobStatus;
  isHighlighted: boolean;
  publishedAt: string;
  expiresAt: string;
}

// Nunca faz parte do payload público. Só é servido após candidatura ativa
// (§16.5) — é o telefone que o trabalhador chama no WhatsApp.
export interface JobPostContact {
  jobPostId: string;
  contactPhone: string;
}
