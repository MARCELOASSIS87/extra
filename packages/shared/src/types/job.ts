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

/**
 * Até onde o anúncio alcança. SEMPRE dentro do que o trabalhador já aceitou
 * (§16.2): o alcance da empresa só ESTREITA, nunca amplia — e quem assinou
 * aquela cidade na mão sempre recebe, por mais longe que more.
 */
export type JobReach =
  | "unrestricted" // PADRÃO: todo mundo que aceitou receber daquela cidade
  | "nearby" // a cidade da vaga mais um raio, em reachRadiusKm
  | "city_only"; // só quem mora na cidade da vaga

// Filtros da listagem pública — espelham a query de GET /v1/jobs (§8).
export interface JobFilters {
  role?: JobRole;
  // Várias porque a listagem abre nas cidades assinadas do trabalhador
  // (§16.2). A URL carrega no máximo uma; a união é resolvida no servidor.
  cityIds?: string[];
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
  // O dado que decide se vale viajar. A plataforma informa, não escolhe.
  providesTransport: boolean;
  // Padrão 'unrestricted': padrão restritivo mata vaga em silêncio (§7.5).
  reach: JobReach;
  // Obrigatório e só válido quando reach = 'nearby'; null nos outros casos.
  reachRadiusKm: number | null;
  vacancies: number;
  applicationsCount: number; // exibido no card; substitui o contato
  maxApplications: number; // vacancies * 3 — ver §16.5
  status: JobStatus;
  isHighlighted: boolean;
  publishedAt: string;
  expiresAt: string;
}
