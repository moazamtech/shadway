/**
 * Turns a studio project into a Sandpack file map.
 *
 * This is the whole point of the editor tier: the project is bundled in the
 * browser by Sandpack, on the author's own machine. Nothing is spawned on the
 * host, so a thousand open editors cost the same as one.
 *
 * Three things are prepared here rather than left to the sandbox:
 *
 * - `@/…` aliases are rewritten to relative imports. Sandpack's bundler does
 *   read `tsconfig.json` paths, but a relative import cannot drift.
 * - Bare `next/*` imports get shims. A component written for the App Router
 *   reaches for `next/image` and `next/link`; the sandbox is plain React, so
 *   those specifiers have to resolve to something.
 * - The app entry is generated: Sandpack's `react-ts` template mounts
 *   `/App.tsx` from its own `/index.tsx`, and the project's page lives at
 *   `/app/page.tsx`, so `/App.tsx` is written to render that page.
 */

import { resolveEntryPage } from "@/lib/preview/entry";
import { splitRadixImports } from "@/lib/preview/radix";

export type SandpackFiles = Record<string, string>;

/**
 * Where a vendored shadcn/ui source is installed inside a project:
 *
 *   ui/button.tsx        -> /components/ui/button.tsx
 *   hooks/use-mobile.ts  -> /hooks/use-mobile.ts
 *   lib/utils.ts         -> /lib/utils.ts
 *
 * An author writes `import { Button } from "@/components/ui/button"` and the
 * file is simply there, exactly as it would be in an installed shadcn project.
 */
export function projectPathFor(vendored: string): string {
  return vendored.startsWith("ui/") ? `/components/${vendored}` : `/${vendored}`;
}

export type SandpackProjectInput = {
  /** Every project file, keyed by `/`-rooted path. */
  files: Record<string, string>;
  /** The compiled project stylesheet, injected as `/styles.css`. */
  compiledCss?: string;
  /** The page `/App.tsx` renders. Defaults to `/app/page.tsx`. */
  page?: string;
  theme?: "light" | "dark";
};

const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];
const INDEXES = ["/index.tsx", "/index.ts", "/index.jsx", "/index.js"];

const IMPORT_RE =
  /(\bimport\s+(?:[\s\S]*?\sfrom\s*)?|\bexport\s+(?:[\s\S]*?\sfrom\s*)|\bimport\s*\(\s*)(["'])([^"']+)\2/g;

function normalize(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

/** Resolves `@/…` and `./…` specifiers against the files that exist. */
export function resolveProjectImport(
  specifier: string,
  fromPath: string,
  known: Set<string>
): string | null {
  const candidates: string[] = [];

  if (specifier.startsWith("@/")) {
    const rest = specifier.slice(2);
    candidates.push(`/${rest}`, `/src/${rest}`);

    // Real projects (and pasted code) drift between `components/ui/` and
    // `components/`; try the sibling spelling too.
    if (rest.startsWith("components/ui/")) {
      candidates.push(`/components/${rest.slice("components/ui/".length)}`);
    } else if (rest.startsWith("components/")) {
      candidates.push(`/components/ui/${rest.slice("components/".length)}`);
    } else if (rest.startsWith("ui/")) {
      candidates.push(`/components/ui/${rest.slice("ui/".length)}`);
    }
  } else if (specifier.startsWith(".")) {
    const stack = normalize(fromPath).split("/").slice(0, -1);
    for (const segment of specifier.split("/")) {
      if (!segment || segment === ".") continue;
      if (segment === "..") stack.pop();
      else stack.push(segment);
    }
    candidates.push(stack.join("/"));
  } else {
    return null;
  }

  for (const candidate of candidates) {
    if (known.has(candidate)) return candidate;
    for (const ext of EXTENSIONS) {
      if (known.has(candidate + ext)) return candidate + ext;
    }
    for (const index of INDEXES) {
      if (known.has(candidate + index)) return candidate + index;
    }
  }

  return null;
}

/** `/components/button.tsx` imported from `/app/page.tsx` -> `../components/button.tsx`. */
export function relativeImport(fromPath: string, toPath: string): string {
  // Every path here is `/`-rooted, so the leading empty segment is not a
  // directory. Keeping it counted the root as one, which made every result one
  // `..` too high: `/app/page.tsx` resolved `@/components/ui/button` to
  // `../../components/ui/button`. Sandpack clamps `..` at the root, so the
  // extra hop was absorbed and the preview still worked — but the path it was
  // handed was wrong, and anything resolving it against a real filesystem (a
  // test, a CLI export) walks out of the project.
  const from = normalize(fromPath).split("/").filter(Boolean);
  from.pop();
  const to = normalize(toPath).split("/").filter(Boolean);

  let shared = 0;
  while (shared < from.length && shared < to.length && from[shared] === to[shared]) shared++;

  const up = from.length - shared;
  const parts = [...Array(up).fill(".."), ...to.slice(shared)];
  const path = parts.join("/") || ".";
  return path.startsWith(".") ? path : `./${path}`;
}

/** Rewrites every resolvable alias/relative import to a relative path. */
export function rewriteImports(
  path: string,
  content: string,
  known: Set<string>
): string {
  // The unified Radix barrel is split before anything else, so the sandbox
  // installs and imports the one primitive that is used instead of all 36 —
  // `import { Dialog } from "radix-ui"` otherwise makes every recompile walk
  // the whole Radix suite. See `lib/preview/radix.ts`.
  return splitRadixImports(content).replace(IMPORT_RE, (match, prefix, quote, specifier) => {
    const bare = specifier.trim();
    if (bare.startsWith("/") || bare.startsWith("node:")) return match;

    const resolved = resolveProjectImport(bare, path, known);
    if (!resolved || resolved === path) return match;

    return `${prefix}${quote}${relativeImport(path, resolved)}${quote}`;
  });
}

/**
 * Pulls `@import` rules out of a stylesheet.
 *
 * The stylesheet is compiled by the real Tailwind compiler, which resolves
 * imports against the file system — so a remote sheet has to become a `<link>`
 * (React hoists it into `<head>`), and everything else is dropped and resolved
 * by the compiler instead. Tailwind's own entry is dropped because the compiler
 * is handed it directly, and `tw-animate-css` is dropped because
 * `compileProjectCss` folds it into the baseline — loading it from a CDN
 * instead would be a second copy of it, over the network, at a version pinned
 * in two places.
 */
export function splitStyleImports(css: string): { style: string; links: string[] } {
  const links: string[] = [];

  const withoutRemote = css.replace(
    /@import\s+url\(\s*["']?(https?:\/\/[^"')]+)["']?\s*\)\s*;?/g,
    (_full, url: string) => {
      links.push(url);
      return "";
    }
  );

  // The browser runtime already ships `tailwindcss`'s own stylesheet; asking
  // it to `@import "tailwindcss"` would try to fetch a package that is not
  // there and drop every rule behind it.
  const style = withoutRemote
    .replace(/@import\s+["']tailwindcss["']\s*;?/g, "")
    .replace(/@import\s+["'][^"']+["']\s*;?/g, "")
    .trim();

  return { style, links };
}

/**
 * Minimal stand-ins for the App Router modules a component may import.
 *
 * They live under `/node_modules` so the sandbox bundler resolves them like an
 * installed package, which keeps a preview rendering instead of stopping on a
 * module it cannot find.
 *
 * Exported so the coverage test can hold this list and the published
 * document's (`lib/preview/build`) to the same set: `next/form` was missing
 * from both, and nothing noticed until a registry example imported it.
 */
export const NEXT_SHIMS: Record<string, string> = {
  "/node_modules/next/package.json": `{
  "name": "next",
  "version": "15.0.0",
  "main": "index.js"
}
`,
  "/node_modules/next/index.js": `export { default as Image } from "./image";
export { default as Link } from "./link";
export { default as Form } from "./form";
export { default as Head } from "./head";
export { default as Script } from "./script";
export { default as dynamic } from "./dynamic";
export { useRouter, usePathname, useSearchParams, useParams, RouterProvider } from "./router";
`,
  "/node_modules/next/image.js": `export default function Image({ src, alt = "", width, height, fill, className, style, ...rest }) {
  const resolved = typeof src === "string" ? src : src?.src;
  const size = fill ? { width: "100%", height: "100%" } : { width, height };
  return <img src={resolved} alt={alt} className={className} style={{ ...size, ...style }} {...rest} />;
}
`,
  "/node_modules/next/link.js": `export default function Link({ href = "#", children, ...rest }) {
  return <a href={typeof href === "string" ? href : "#"} {...rest}>{children}</a>;
}
`,
  "/node_modules/next/router.js": `import { createContext, useContext } from "react";

const router = {
  pathname: "/",
  query: {},
  asPath: "/",
  push() {},
  replace() {},
  prefetch() {},
  back() {},
};

const RouterContext = createContext(router);

export const useRouter = () => router;
export const usePathname = () => router.pathname;
export const useSearchParams = () => new URLSearchParams();
export const useParams = () => ({});
export const RouterProvider = ({ children }) => (
  <RouterContext.Provider value={router}>{children}</RouterContext.Provider>
);
`,
  "/node_modules/next/navigation.js": `export { useRouter, usePathname, useSearchParams, useParams } from "./router";
`,
  "/node_modules/next/form.js": `export function Form({ children, ...rest }) {
  return <form {...rest}>{children}</form>;
}
export default Form;
`,
  "/node_modules/next/head.js": `export default function Head({ children }) {
  return <>{children}</>;
}
`,
  "/node_modules/next/script.js": `export default function Script({ children, ...rest }) {
  return <script {...rest}>{children}</script>;
}
`,
  "/node_modules/next/dynamic.js": `import { Suspense, lazy } from "react";

export default function dynamic(loader, options = {}) {
  const Lazy = lazy(loader);
  const Fallback = options.loading ?? (() => null);
  return function DynamicComponent(props) {
    return (
      <Suspense fallback={<Fallback />}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}
`,
  "/node_modules/next/font.js": `const font = () => ({ className: "font-sans", variable: "--font-sans", style: {} });
export default font;
export { font as Inter, font as Roboto };
`,
  "/node_modules/next/font/google.js": `const font = () => ({ className: "font-sans", variable: "--font-sans", style: {} });
export default font;
export const Inter = font;
export const Roboto = font;
export const Geist = font;
export const Geist_Mono = font;
export const JetBrains_Mono = font;
export const IBM_Plex_Mono = font;
export const Fira_Code = font;
export const Source_Code_Pro = font;
export const Poppins = font;
export const Manrope = font;
export const DM_Sans = font;
export const DM_Serif_Display = font;
export const Outfit = font;
export const Space_Grotesk = font;
export const Plus_Jakarta_Sans = font;
export const Nunito_Sans = font;
export const Work_Sans = font;
export const Montserrat = font;
export const Raleway = font;
export const Lato = font;
export const Open_Sans = font;
export const Oswald = font;
export const Playfair_Display = font;
export const Instrument_Sans = font;
export const Instrument_Serif = font;
export const Bricolage_Grotesque = font;
export const Archivo = font;
export const Figtree = font;
export const Sora = font;
export const Public_Sans = font;
export const Noto_Sans = font;
export const Noto_Serif = font;
`,
  "/node_modules/next/font/local.js": `export default function localFont() {
  return { className: "font-sans", variable: "--font-sans", style: {} };
}
`,
  "/node_modules/next/document.js": `export default function Document() {
  return null;
}
`,
};

/**
 * The preview document.
 *
 * The sandbox serves this in place of the template's own `index.html`. Styling
 * is not done here — the compiled stylesheet is imported by `/App.tsx`, which
 * is the only channel the sandbox reliably honours.
 */
function previewHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
    <style>
      html, body { height: 100%; }
      body { margin: 0; }
    </style>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}

export type SandpackProject = {
  files: SandpackFiles;
};

export function buildSandpackProject({
  files,
  compiledCss,
  page,
  theme = "light",
}: SandpackProjectInput): SandpackProject {
  const normalized: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    normalized[normalize(path)] = content;
  }

  const known = new Set(Object.keys(normalized));
  const rewritten: Record<string, string> = {};
  for (const [path, content] of Object.entries(normalized)) {
    rewritten[path] = rewriteImports(path, content, known);
  }

  /**
   * The page the sandbox mounts.
   *
   * `page` is a preference, not a requirement: a block installs its page at
   * `app/<name>/page.tsx` rather than `/app/page.tsx`, and the sandbox used to
   * render "Nothing to preview yet" over a project that had a perfectly good
   * page in it. See `resolveEntryPage`.
   */
  const demoPath = resolveEntryPage(
    Object.entries(normalized).map(([path, content]) => ({ path, content })),
    page
  );

  // The sandbox does not apply `index.html`'s `<html>` attributes, so the theme
  // class is set from the entry module: once at module scope, before React
  // renders (so there is no flash of the wrong theme), and again on every
  // render, so a theme change that only re-renders the tree still lands.
  const themeSync = `const __shadwayDark = ${theme === "dark"};
function __shadwaySyncTheme() {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", __shadwayDark);
  }
}
__shadwaySyncTheme();
`;

  const appEntry = `import "./styles.css";
${
  demoPath
    ? `import Demo from "${relativeImport("/App.tsx", demoPath)}";\n`
    : `const Demo = () => <div style={{ padding: 24 }}>Nothing to preview yet.</div>;\n`
}
${themeSync}
export default function App() {
  __shadwaySyncTheme();
  return <Demo />;
}
`;

  return {
    files: {
      ...NEXT_SHIMS,
      ...rewritten,
      "/App.tsx": appEntry,
      "/styles.css": compiledCss ?? "",
      "/public/index.html": previewHtml(),
      // Aliases are rewritten above, but a pasted import can still slip
      // through; the template's own `tsconfig.json` is left as it is.
      "/tsconfig.json": JSON.stringify(
        {
          compilerOptions: {
            jsx: "react-jsx",
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            baseUrl: ".",
            paths: { "@/*": ["./*"] },
          },
          include: ["./**/*"],
        },
        null,
        2
      ),
    },
  };
}
