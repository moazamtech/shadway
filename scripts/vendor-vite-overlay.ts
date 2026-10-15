/**
 * Vendors Vite's own error overlay (MIT) into `public/preview/vite-overlay.js`
 * so every Shadway preview shows the same error log a Vite dev server shows.
 *
 * The overlay is the real thing, not a lookalike: it is compiled from
 * vitejs/vite `packages/vite/src/client/overlay.ts`, which is the custom
 * element a React + Vite app renders when it crashes. The only edits are the
 * two build-time defines the Vite dev plugin normally injects (`__BASE__`,
 * `__HMR_CONFIG_NAME__`).
 *
 * Usage: npx tsx scripts/vendor-vite-overlay.ts   (needs network access)
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
// @ts-expect-error - @babel/core ships no bundled types in this setup.
import { transformAsync } from "@babel/core";

const SOURCE_URL =
  "https://raw.githubusercontent.com/vitejs/vite/main/packages/vite/src/client/overlay.ts";

const BANNER = `/* Vite error overlay (MIT) — vendored from vitejs/vite
   packages/vite/src/client/overlay.ts. Regenerate with:
   npx tsx scripts/vendor-vite-overlay.ts */
`;

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Could not fetch the overlay source: HTTP ${response.status}`);
  }

  let source = await response.text();

  // The dev plugin injects these; bake in the static values instead.
  source = source
    .replace(/^declare const __BASE__.*$/gm, "")
    .replace(/^declare const __HMR_CONFIG_NAME__.*$/gm, "")
    .replace(/__BASE__/g, '"/"')
    .replace(/__HMR_CONFIG_NAME__/g, '""');

  const result = await transformAsync(source, {
    filename: "vite-overlay.ts",
    babelrc: false,
    configFile: false,
    sourceMaps: false,
    compact: false,
    presets: [["@babel/preset-typescript", { onlyRemoveTypeImports: true }]],
  });

  const code = BANNER + (result?.code ?? "");
  if (!code.includes("vite-error-overlay")) {
    throw new Error("The compiled overlay looks wrong — custom element name missing.");
  }

  const outDir = join(process.cwd(), "public", "preview");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "vite-overlay.js"), code, "utf8");
  console.log(`wrote public/preview/vite-overlay.js (${code.length} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
