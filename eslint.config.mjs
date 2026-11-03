import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
  {
    // Only the db layer, auth and the session helper may touch the raw database client.
    // Everything else gets a user-scoped handle from requireUser(). Types are fine to share.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/db/**", "src/lib/auth.ts", "src/lib/session.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db/client",
              message: "Use requireUser() and its scoped db, not the raw client.",
              allowTypeImports: true,
            },
            {
              name: "@/lib/db/scoped",
              importNames: ["RAW"],
              message: "RAW is for query modules inside src/lib/db only.",
            },
          ],
          patterns: [
            {
              group: ["**/db/client"],
              message: "Use requireUser() and its scoped db, not the raw client.",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "legacy/**", "drizzle/**", ".pglite/**", ".pglite-e2e/**", "playwright-report/**", "test-results/**"]),
]);
