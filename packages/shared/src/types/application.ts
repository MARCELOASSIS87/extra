export type ApplicationStatus =
  "applied" | "confirmed" | "withdrawn" | "no_response";

export interface Application {
  id: string;
  jobPostId: string;
  workerId: string;
  status: ApplicationStatus;
  appliedAt: string;
  confirmedAt: string | null; // confirmação de véspera
}
