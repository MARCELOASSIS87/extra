import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

// eslint-config-next ships globs with no directory prefix; scope them to
// apps/web so apps/api and packages/shared don't get React/browser rules.
const scopeToWeb = (configs) =>
  configs
    .filter((cfg) => !("ignores" in cfg && Object.keys(cfg).length === 1))
    .map((cfg) => ({
      ...cfg,
      files: (cfg.files ?? ["**/*.{js,jsx,ts,tsx,mjs,mts}"]).map(
        (pattern) => `apps/web/${pattern}`,
      ),
      ...(cfg.settings && {
        settings: { ...cfg.settings, next: { rootDir: "apps/web" } },
      }),
    }));

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/build/**",
      "**/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: globals.node } },
  { files: ["apps/web/**"], languageOptions: { globals: globals.browser } },
  ...scopeToWeb(nextCoreWebVitals),
  eslintConfigPrettier,
);
