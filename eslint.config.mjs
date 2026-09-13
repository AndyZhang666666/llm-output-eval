import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build trees that were moved aside rather than deleted (a sandboxed shell
    // cannot bulk-delete 10k files). Without these the linter walks generated
    // bundles and reports thousands of errors that are not ours.
    ".next.stale-*/**",
    "out.stale-*/**",
    // Compiled copy of the app's prompt/parser used by validation/. Generated,
    // and gitignored — but eslint does not read .gitignore.
    "validation/.lib/**",
  ]),
]);

export default eslintConfig;
