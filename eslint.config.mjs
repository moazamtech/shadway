import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
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
    ],
  },
];

export default eslintConfig;
