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
  cityId?: string;
  neighborhood?: string;
  // Dia do calendário em America/Sao_Paulo ("YYYY-MM-DD"), não instante: quem
  // filtra está procurando "vagas de sábado", não um intervalo em UTC.
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
  startsAt: string; // ISO 8601 UTC
  // ISO 8601 UTC. PODE cair no dia seguinte: formatura entra 22h e sai 2h.
  endsAt: string;
  payAmount: number; // real inteiro, sem centavos. INFORMATIVO: não processamos.
  payNote: string | null;
  address: string;
  neighborhood: string;
  cityId: string;
  requirements: string | null; // uniforme etc — exigência DA EMPRESA
  vacancies: number;
  applicationsCount: number; // exibido no card; substitui o contato
  maxApplications: number; // vacancies * 3 — ver §16.5
  status: JobStatus;
  isHighlighted: boolean;
  publishedAt: string;
  expiresAt: string;
}
