import type {
  WorkerApplicantProfile,
  WorkerPublicProfile,
} from "./worker";
import type { PublicJobPost } from "./job";
import type { AttendanceStatus } from "./attendance";

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

/**
 * Um candidato na lista da empresa (§8, §16.5). O perfil vem da view
 * `worker_public_profiles`, nunca da tabela `workers`: a view não alcança
 * `accounts` e não seleciona cpf nem birth_date, então o telefone não vaza
 * por uma coluna que a consulta nem enxerga.
 *
 * Não existe telefone AQUI de propósito. Ele só sai por
 * `GET /v1/applications/:id/contact`, e o ato de pedir é o ato de escolher.
 */
export interface JobApplicant {
  application: Application;
  worker: WorkerPublicProfile;
  /**
   * Entre os centros dos municípios. `null` quando o par não está na tabela
   * de vizinhança (acima de 100 km) — a tela escreve "cerca de", nunca um
   * número exato.
   */
  distanceKm: number | null;
}

/**
 * A tela "candidatos da vaga" (§16.5): a vaga mais os candidatos dela, cada um
 * com o que a empresa precisa para escolher — perfil, distância, quantas vezes
 * ELA já registrou presença dessa pessoa, e o que ela já marcou nesta vaga
 * (para a tela não oferecer marcar duas vezes).
 *
 * SEM telefone, e é o ponto: uma vaga de seis aceita dezoito candidaturas, e
 * uma lista com dezoito números é uma lista telefônica que basta abrir o
 * DevTools para copiar — não importa que a tela não os desenhe. Quem quer
 * falar pede um por vez em `GET /v1/applications/:id/contact` (regra 8).
 */
export interface JobCandidate {
  application: Application;
  worker: WorkerApplicantProfile;
  /** Entre os centros dos municípios; `null` acima de 100 km. */
  distanceKm: number | null;
  /** Presenças que ESTA empresa já registrou para ele. */
  presentWithCompany: number;
  /** O que esta empresa já marcou NESTA vaga, ou `null` se ainda não marcou. */
  attendanceStatus: AttendanceStatus | null;
}

export interface JobCandidates {
  job: PublicJobPost;
  candidates: JobCandidate[];
}

/**
 * Uma candidatura nova no painel da empresa: a fila de "candidatos novos",
 * de TODAS as vagas dela. Sem telefone, pela mesma razão de `JobCandidate`.
 */
export interface NewApplicant {
  application: Application;
  job: PublicJobPost;
  worker: WorkerPublicProfile;
}

/**
 * A resposta da única rota que revela um telefone. `contactedAt` volta junto
 * porque o clique É o ato de escolher (§16.5): quem chamou fica registrado, e
 * a data da primeira vez nunca é reescrita.
 */
export interface ApplicationContact {
  applicationId: string;
  phone: string;
  /**
   * O nome completo vem JUNTO com o telefone, porque é a mesma decisão: pedir
   * o contato é o ato de escolher, e é ele que abre os dois (§16.5, regra 8).
   * A lista atualiza com este valor sem recarregar tudo.
   */
  fullName: string;
  contactedAt: string;
}

/** A candidatura do trabalhador com a vaga junto: a tela dele precisa das duas,
 * e uma chamada por candidatura seria N+1 no celular de quem tem 4G. */
export interface MyApplication {
  application: Application;
  job: PublicJobPost;
  /**
   * O desfecho EFETIVO (§16.7), já derivado pelo servidor: `pending` enquanto
   * a empresa ainda pode marcar, `not_selected` passados 7 dias do fim do
   * trabalho. `null` quando o trabalho ainda nem terminou.
   *
   * Vem pronto para a tela nunca comparar data e nunca concluir falta de um
   * silêncio — a decisão é do servidor, igual a `hasHistory` (§16.6).
   */
  attendanceStatus: AttendanceStatus | null;
}
