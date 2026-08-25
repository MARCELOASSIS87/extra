import { z } from "zod";

/**
 * Telefone em E.164 — é a credencial (§7.2), não um atributo de perfil, e por
 * isso mora num arquivo só dele: cadastro do trabalhador, cadastro da empresa
 * e login validam exatamente a mesma coisa. Três cópias da mesma regex é como
 * um dos três aceita um número que os outros recusam.
 */
export const phoneE164Schema = z
  .string()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    "Telefone deve estar no formato internacional (+55...)",
  );
