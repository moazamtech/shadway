import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * `eslint-config-next` 16 ships flat config, so it is imported directly.
 *
 * This used to go through `FlatCompat.extends("next/core-web-vitals")`, which
 * is how the older shareable configs were loaded — and against a flat config it
 * does not fail loudly, it fails at *serialization*: ESLint tries to validate
 * the resolved config, walks the plugin objects, finds the cycle every plugin
 * has back to itself, and throws "Converting circular structure to JSON" before
 * it lints a single file. `npx eslint <any file>` exited 2 with that error, so
 * nothing in this repo was being linted at all.
 */
const eslintConfig = defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      /**
       * The React Compiler rules are new in `eslint-plugin-react-hooks` 6 and
       * arrive as errors. They are warnings here because this repo has never
       * been linted — the config below was broken, so none of them have ever
       * been reported — and turning ~85 errors on across 113 files at once is
       * how a lint setup gets ignored again.
       *
       * They are worth reading, not silencing: `set-state-in-effect` and
       * `refs` fire on the studio's sandbox pane, which manages a bundler's
       * lifetime and mirrors state into it deliberately. Each one wants its own
       * pass, with the regression tests that cover that pane in hand.
       */
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
    },
  },
  globalIgnores([
    // eslint-config-next's own defaults.
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored/generated preview assets: the shadcn/ui sources the preview
    // ships (scripts/sync-shadcn-ui.ts) and the Vite error overlay
    // (scripts/vendor-vite-overlay.ts) keep their upstream `@ts-nocheck`
    // banners.
    "lib/preview/template/**",
    "public/preview/**",
  ]),
]);

export default eslintConfig;
