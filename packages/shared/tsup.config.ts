import { defineConfig } from "tsup";

/**
 * O shared precisa existir em runtime, não só como tipo: a partir da Fase 4 a
 * API importa schema zod de verdade, e `exports` apontando para `.ts` só
 * funcionava porque nada além de `import type` era emitido.
 *
 * Cada arquivo de `src` vira uma entrada própria, sem barrel: é o que mantém
 * o mapa de `exports` por subcaminho (`@extra/shared/schemas/job`) idêntico
 * ao de antes, e o que impede um import de tipo de arrastar o pacote inteiro.
 */
export default defineConfig({
  entry: ["src/**/*.ts", "!src/**/*.test.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});
