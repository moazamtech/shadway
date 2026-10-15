import "dotenv/config";

/**
 * Vendors the complete shadcn/ui registry into `lib/preview/template`.
 *
 * The studio and the published previews hand user code a real `components/ui`
 * folder, so any component from the docs can be imported without the author
 * having to paste the source first. The registry is the source of truth; run
 * this whenever it should be refreshed:
 *
 *   npx tsx scripts/sync-shadcn-ui.ts
 *
 * The vendored files are data, not part of the app build: they live under a
 * directory the TypeScript project excludes, and are read at preview time.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const REGISTRY = "https://ui.shadcn.com/r";
const STYLE = "new-york-v4";
const OUT_DIR = join("lib", "preview", "template");

type RegistryFile = {
  path: string;
  content: string;
  type?: string;
};

type RegistryItem = {
  name: string;
  type: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: RegistryFile[];
};

type ThemeColorItem = {
  cssVarsV4?: { light?: Record<string, string>; dark?: Record<string, string> };
};

const TAILWIND_STYLE_URL = "https://unpkg.com/shadcn@latest/tailwind.css";
const TAILWIND_ANIMATE_URL =
  "https://unpkg.com/tw-animate-css@latest/dist/tw-animate.css";
const THEME_COLORS_URL = "https://ui.shadcn.com/r/colors/neutral.json";

/**
 * The same shapes the shadcn docs print for Tailwind v4 projects: the
 * utilities package, the animation utilities, every `--color-*` a component
 * class refers to, and the neutral palette's values.
 */
function themeCss(
  tailwindStyle: string,
  animate: string,
  colors: ThemeColorItem,
): string {
  const light = colors.cssVarsV4?.light ?? {};
  const dark = colors.cssVarsV4?.dark ?? {};

  const tokenBlock = (vars: Record<string, string>) =>
    Object.entries(vars)
      .map(([name, value]) => `  --${name}: ${value};`)
      .join("\n");

  const colorNames = Object.keys(light).filter((name) => name !== "radius");

  return [
    "@custom-variant dark (&:is(.dark *));",
    tailwindStyle.trim(),
    animate.trim(),
    "@theme inline {",
    ...colorNames.map((name) => `  --color-${name}: var(--${name});`),
    "  --radius-sm: calc(var(--radius) - 4px);",
    "  --radius-md: calc(var(--radius) - 2px);",
    "  --radius-lg: var(--radius);",
    "  --radius-xl: calc(var(--radius) + 4px);",
    "}",
    ":root {",
    tokenBlock(light),
    "}",
    ".dark {",
    tokenBlock(dark),
    "}",
    "@layer base {",
    "  * { @apply border-border outline-ring/50; }",
    "  body { @apply bg-background text-foreground; }",
    "}",
  ].join("\n");
}

/**
 * Rewrites the pieces of a vendored file that assume the shadcn CLI's own
 * project layout, so the same source compiles against the preview's
 * `/src/components/ui/*` tree.
 */
function normalize(content: string, name: string): string {
  let result = content
    // The registry now ships `cn` as its own package. Every shadcn project —
    // and the preview — keeps the same helper at `@/lib/utils`.
    .replace(/from "cn"/g, 'from "@/lib/utils"')
    // Cross-component imports point at the registry's internal layout.
    .replace(/from "@\/registry\/new-york-v4\/ui\//g, 'from "@/components/ui/')
    .replace(/from "@\/registry\/new-york-v4\/hooks\//g, 'from "@/hooks/')
    .replace(/from "@\/registry\/new-york-v4\/lib\//g, 'from "@/lib/');

  if (name === "utils") {
    // The registry's copy only re-exports the `cn` package. The preview
    // builds the same helper from its two well-known parts so nothing in the
    // sandbox depends on the package's resolution.
    result = `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;
  }

  if (name === "sonner") {
    // `next-themes` has no provider inside the preview iframe, and its hook
    // returns undefined without one — destructuring it would throw. The
    // preview only ever runs light or dark, so the system theme is implied.
    result = result
      .replace(/import\s+\{\s*useTheme\s*\}\s+from\s+"next-themes"\s*\n/, "")
      .replace(
        /const\s+\{\s*theme\s*=\s*"system"\s*\}\s*=\s*useTheme\(\)/,
        'const theme = "system"',
      );
  }

  return result;
}

/** `registry/new-york-v4/ui/button.tsx` -> `ui/button.tsx` */
function aliasPath(file: RegistryFile): string | null {
  const marker = `registry/${STYLE}/`;
  const index = file.path.indexOf(marker);
  if (index === -1) return null;
  return file.path.slice(index + marker.length);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} -> ${response.status}`);
  }
  return (await response.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} -> ${response.status}`);
  }
  return response.text();
}

async function main() {
  const index = await fetchJson<{ name: string }[]>(`${REGISTRY}/index.json`);
  // A handful of items components depend on are not listed in the index
  // itself (hooks, the `cn` helper), so they are requested by name.
  const names = Array.from(
    new Set([
      ...index.map((item) => item.name).filter(Boolean),
      "use-mobile",
      "utils",
    ]),
  );
  console.log(`registry lists ${names.length} items`);

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const manifest: Record<
    string,
    {
      files: string[];
      dependencies: string[];
      registryDependencies: string[];
    }
  > = {};

  const sources: Record<string, string> = {};

  const failures: string[] = [];
  const skipped: string[] = [];

  for (const name of names) {
    try {
      const item = await fetchJson<RegistryItem>(
        `${REGISTRY}/styles/${STYLE}/${name}.json`,
      );

      const files: string[] = [];
      for (const file of item.files ?? []) {
        const target = aliasPath(file);
        if (!target || !file.content) continue;
        const content = normalize(file.content, name);
        const outPath = join(OUT_DIR, target);
        mkdirSync(dirname(outPath), { recursive: true });
        // The files are compiled and typechecked the way a preview compiles
        // them — the registry's own dependencies (the unified `radix-ui`
        // package, recharts builds) are not installed in this repo, so the
        // checked-in copies opt out of the project's typecheck.
        writeFileSync(outPath, `// @ts-nocheck\n${content}`, "utf8");
        files.push(target);
        sources[target] = content;
      }

      manifest[name] = {
        files,
        dependencies: item.dependencies ?? [],
        registryDependencies: item.registryDependencies ?? [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // The index carries a few planning-stage names with no published file.
      if (message.endsWith("-> 404")) {
        skipped.push(name);
        continue;
      }
      failures.push(name);
      console.warn(`  ${name}: ${message}`);
    }
  }

  writeFileSync(
    join(OUT_DIR, "manifest.json"),
    JSON.stringify({ style: STYLE, items: manifest }, null, 2),
    "utf8",
  );

  // A single importable module, so the previews never touch the filesystem at
  // request time and bundlers can trace the data automatically.
  writeFileSync(
    join(OUT_DIR, "bundle.ts"),
    `/**
 * Generated by scripts/sync-shadcn-ui.ts — do not edit by hand.
 *
 * Every file of the shadcn/ui registry, keyed by its alias path
 * (\`ui/button.tsx\`, \`hooks/use-mobile.ts\`, \`lib/utils.ts\`).
 */
export const SHADCN_FILES: Record<string, string> = ${JSON.stringify(
      sources,
      null,
      2,
    )};
`,
    "utf8",
  );

  // The components alone, for client UI that lists what is available: the
  // file, and the names the file exports so the studio can insert a working
  // import without the author memorising the API.
  const uiItems = Object.entries(manifest)
    .filter(([, item]) => item.files.some((file) => file.startsWith("ui/")))
    .map(([name, item]) => {
      const file = item.files.find((path) => path.startsWith("ui/")) as string;
      const content = sources[file] ?? "";
      const exports = Array.from(content.matchAll(/^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/gm)).map(
        (match) => match[1],
      );
      for (const group of content.matchAll(/^export\s*\{([^}]+)\}/gm)) {
        for (const raw of group[1].split(",")) {
          const name = raw.replace(/\btype\b/, "").trim().split(/\s+as\s+/).pop()?.trim();
          if (name && /^[A-Za-z_$][\w$]*$/.test(name)) exports.push(name);
        }
      }
      return {
        name,
        path: `@/components/${file.replace(/\.tsx?$/, "")}`,
        exports: Array.from(new Set(exports)),
      };
    })
    .filter((item) => item.exports.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  writeFileSync(
    join(OUT_DIR, "names.ts"),
    `/**
 * Generated by scripts/sync-shadcn-ui.ts — do not edit by hand.
 *
 * The components in the vendored shadcn/ui folder, with the names each file
 * exports — what the studio lists and inserts imports from.
 */
export type ShadcnUiItem = { name: string; path: string; exports: string[] };

export const SHADCN_UI_COMPONENTS: ShadcnUiItem[] = ${JSON.stringify(uiItems, null, 2)};

/** Just the names, sorted. */
export const SHADCN_UI_NAMES: string[] = SHADCN_UI_COMPONENTS.map((item) => item.name);

/** Every vendored file, by its registry alias path (\`ui/button.tsx\`). */
export const SHADCN_FILE_PATHS: string[] = ${JSON.stringify(
      Object.keys(sources).sort(),
    )};
`,
    "utf8",
  );

  // The preview stylesheet: everything a shadcn Tailwind v4 project would
  // have in globals.css, ready to inline into a preview document.
  const [tailwindStyle, animate, themeColors] = await Promise.all([
    fetchText(TAILWIND_STYLE_URL),
    fetchText(TAILWIND_ANIMATE_URL),
    fetchJson<ThemeColorItem>(THEME_COLORS_URL),
  ]);

  writeFileSync(
    join("lib", "preview", "theme.generated.ts"),
    `/**
 * Generated by scripts/sync-shadcn-ui.ts — do not edit by hand.
 *
 * The Tailwind v4 stylesheet every preview runs: the shadcn utilities, the
 * animation utilities, and the neutral theme tokens mapped to Tailwind's
 * color names.
 */
export const PREVIEW_THEME_CSS = ${JSON.stringify(
      themeCss(tailwindStyle, animate, themeColors),
    )};
`,
    "utf8",
  );

  const fileCount = Object.values(manifest).reduce(
    (sum, item) => sum + item.files.length,
    0,
  );
  console.log(
    `vendored ${Object.keys(manifest).length} items, ${fileCount} files -> ${OUT_DIR}`,
  );
  if (skipped.length) console.log(`skipped (not published): ${skipped.join(", ")}`);
  if (failures.length) {
    console.error(`failed: ${failures.join(", ")}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
