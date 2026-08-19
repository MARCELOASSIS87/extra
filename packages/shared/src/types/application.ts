export type ApplicationStatus =
  "applied" | "confirmed" | "withdrawn" | "no_response";

export interface Application {
  id: string;
  shortCode: string; // 4 caracteres, ex "A7K2" — vai na mensagem do WhatsApp (§16.5)
  jobPostId: string;
  workerId: string;
  status: ApplicationStatus;
  appliedAt: string;
  contactedAt: string | null; // quando tocou em "Falar no WhatsApp"
  confirmedAt: string | null; // confirmação de véspera
}
