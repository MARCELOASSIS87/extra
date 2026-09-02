import type { PublicJobPost } from "./job";
import type { WorkerApplicantProfile } from "./worker";

export interface AttendanceSummary {
  present: number;
  absent: number;
  distinctCompanies: number;
  // false → a UI escreve "Novo por aqui", NUNCA "0 presenças" (§16.6). Quem
  // decide é o servidor: a interface nunca interpreta um zero.
  hasHistory: boolean;
  // NUNCA existe rating, stars, score ou comment.
}

/**
 * Só o que a empresa marcou. Contestação é outra dimensão (ver
 * `AttendanceRecord`): se fosse valor de status, contestar uma falta apagaria
 * a marcação original.
 *
 * "not_selected" é neutro: não entra em present nem em absent e nunca aparece
 * no perfil público (§16.7).
 */
export type AttendanceStatus =
  | "pending" // aguardando a empresa marcar
  | "not_selected" // não foi chamado — NEUTRO
  | "present" // foi chamado e compareceu
  | "absent"; // foi chamado e NÃO compareceu — só isto é falta

export type DisputeOutcome = "upheld" | "reversed";

// A empresa marca presente, ausente ou "não chamei" (§16.7). "pending" é o
// estado de partida, nunca uma escolha de quem marca.
export interface AttendanceMarkInput {
  workerId: string;
  status: Extract<AttendanceStatus, "present" | "absent" | "not_selected">;
}

export interface AttendanceRecord {
  id: string;
  // Derivados, nunca armazenados — igual ao teto de candidaturas. A tabela
  // guarda só `applicationId`; estes três chegam pela candidatura, no join
  // que serve a leitura (attendance_records → applications → job_posts).
  //
  // Foram colunas de verdade e deixaram de ser: cópia do que a candidatura já
  // diz envelhece, e a chave composta que a mantinha honesta era objeto que o
  // Prisma modela — fora do histórico de migrations virava drift permanente.
  // Sai a cópia, não a garantia. Quem nunca é gravado não tem como divergir.
  workerId: string;
  companyId: string;
  jobPostId: string;
  status: AttendanceStatus;
  markedAt: string | null; // null enquanto o status é "pending"
  // Contestar não apaga a marcação: `status` continua sendo o que a empresa
  // marcou. "Em contestação" é disputedAt != null && disputeResolvedAt == null.
  disputedAt: string | null; // contestação em até 7 dias
  disputeResolvedAt: string | null;
  disputeOutcome: DisputeOutcome | null;
  // Sem expiresAt: é markedAt + 12 meses, calculado na leitura. Cópia
  // guardada seria uma segunda fonte de verdade para um valor derivado.
  // Sem campo de texto livre. É a regra que evita ação por dano moral.
}

/**
 * Um item da fila de marcação da empresa (§16.4). Vem do
 * `GET /v1/companies/me/attendance/pending`, e é o que o card precisa para a
 * empresa lembrar quem foi e em qual vaga — ela marca dias depois do evento,
 * e sem nome, função, data e local juntos a marcação vira chute.
 *
 * SEM telefone, e é o ponto (§16.5, regra 8): uma fila que carrega números é
 * uma lista telefônica, mesmo que a tela não os desenhe. O `applicationId`
 * está aqui para pedir o contato um por vez, e o pedido registra a escolha.
 *
 * Só o nome público — primeiro nome e a inicial do sobrenome, como a view
 * devolve. A fila é tela de empresa, não motivo para servir nome completo.
 */
export interface AttendancePendingItem {
  applicationId: string;
  shortCode: string;
  /**
   * A vaga inteira e o perfil de candidato, como nas outras telas da empresa.
   * A fila mostra o mesmo card de candidato que a lista da vaga — servir aqui
   * uma versão achatada obrigaria a tela a ter dois desenhos do mesmo card.
   */
  job: PublicJobPost;
  worker: WorkerApplicantProfile;
}
