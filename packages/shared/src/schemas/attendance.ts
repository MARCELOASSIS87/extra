import { z } from "zod";
import type { AttendanceStatus } from "../types/attendance";

/**
 * Os três desfechos que a empresa pode escolher (§16.7). `pending` não está
 * aqui de propósito: é o estado de partida, nunca uma escolha de quem marca.
 */
const markableValues = [
  "present",
  "absent",
  "not_selected",
] as const satisfies readonly AttendanceStatus[];

export const attendanceMarkStatusSchema = z.enum(markableValues);

/**
 * A marcação inteira, e nada além dela.
 *
 * `.strict()` não é zelo: é a regra 5 do CLAUDE.md virando mecanismo. Não
 * existe — e não pode passar a existir — nenhuma coluna de texto em
 * `attendance_records`, porque texto livre em avaliação é o que gera ação por
 * dano moral. Um objeto aberto aceitaria `observacao` calado, o campo chegaria
 * ao log da requisição, e alguém acabaria persistindo. Chave desconhecida é
 * 400, e é assim que a ausência fica defendida em vez de combinada.
 *
 * Identificado por `applicationId`, não por `workerId`: `attendance_records` é
 * 1:1 com a candidatura e não tem mais coluna de trabalhador — quem apontava
 * para ele eram cópias denormalizadas que saíram do modelo (§7.4).
 */
export const attendanceMarkSchema = z
  .object({
    applicationId: z.uuid("Candidatura inválida"),
    status: attendanceMarkStatusSchema,
  })
  .strict();

export type AttendanceMarkBody = z.infer<typeof attendanceMarkSchema>;
