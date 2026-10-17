import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // These Node entry points intentionally use CommonJS.
    files: ["server.js", "server_isolation.js", "parse-opening-data.js"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated deployment copies and the vendored engine are not source code.
    "deploy/**",
    "deploy_old_*/**",
    "backups/**",
    "public/stockfish.js",
    // HTML reference captures stored with a .js extension for opening imports.
    "openings/alien gambit.js",
    "openings/halloween gambit.js",
  ]),
]);

export default eslintConfig;
