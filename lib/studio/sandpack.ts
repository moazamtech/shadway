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
 * The call a `next/font` binding answers with.
 *
 * The project's own options are honoured rather than thrown away: an author who
 * wrote `Inter({ subsets: ["latin"], variable: "--font-inter" })` and then set
 * `--font-inter` on an element was handed `"--font-sans"` back, so the variable
 * they referenced never existed and the element inherited nothing. The class
 * name stays the theme's default, because a preview cannot download a webfont
 * and `font-sans` is what the project's own theme asked for.
 */
const FONT_FN = `(options = {}) => ({
  className: "font-sans",
  variable: options.variable ?? "--font-sans",
  style: {},
})`;

/**
 * The fonts every project gets whether it asked for them or not.
 *
 * `next/font/google` exports one binding per Google font and there are thousands
 * of them, so a fixed list is a hard `export 'Anton' was not found` for
 * everything outside it — a landing page importing `Anton` or `Syne` built in
 * the published document and came down in the studio. The list is kept as a
 * floor under the project's own imports, not as the whole surface; `fontModules`
 * unions the two.
 */
export const DEFAULT_FONT_NAMES = [
  "Inter",
  "Roboto",
  "Geist",
  "Geist_Mono",
  "JetBrains_Mono",
  "IBM_Plex_Mono",
  "Fira_Code",
  "Source_Code_Pro",
  "Poppins",
  "Manrope",
  "DM_Sans",
  "DM_Serif_Display",
  "Outfit",
  "Space_Grotesk",
  "Plus_Jakarta_Sans",
  "Nunito_Sans",
  "Work_Sans",
  "Montserrat",
  "Raleway",
  "Lato",
  "Open_Sans",
  "Oswald",
  "Playfair_Display",
  "Instrument_Sans",
  "Instrument_Serif",
  "Bricolage_Grotesque",
  "Archivo",
  "Figtree",
  "Sora",
  "Public_Sans",
  "Noto_Sans",
  "Noto_Serif",
];

const FONT_IMPORT_RE =
  /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*["']next\/font(?:\/(?:google|local))?["']/g;

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * The font helpers a project imports, across every `next/font` entry point.
 *
 * Read the same way as `collectFontNames` in `lib/preview/build.ts`, so the two
 * surfaces cannot drift: both are generated from the project's own imports,
 * which is the only thing that knows which of the thousands of names are
 * needed.
 */
function collectFontNames(sources: string[]): string[] {
  const names = new Set<string>();

  for (const content of sources) {
    for (const match of content.matchAll(FONT_IMPORT_RE)) {
      for (const raw of match[1].split(",")) {
        // `{ Syne as Display }` wants `Syne`; `{ type Inter }` is a type; and
        // anything left that is not an identifier would be a syntax error in
        // the module the sandbox is about to compile.
        const name = raw
          .trim()
          .replace(/^type\s+/, "")
          .split(/\s+as\s+/)[0]
          .trim();
        if (IDENTIFIER_RE.test(name)) names.add(name);
      }
    }
  }

  return [...names];
}

/** One `next/font` module: the call, its default, and one binding per font. */
function fontModule(binding: string, names: string[]): string {
  return [
    `const ${binding} = ${FONT_FN};`,
    `export default ${binding};`,
    ...names.map((name) => `export const ${name} = ${binding};`),
  ].join("\n");
}

const DEFAULT_FONT_SHIM = fontModule("font", DEFAULT_FONT_NAMES);
const DEFAULT_LOCAL_FONT_SHIM = fontModule("localFont", DEFAULT_FONT_NAMES);

/**
 * The font modules, for exactly the fonts this project imports on top of the
 * defaults. Written over the fixed ones in `buildSandpackProject`.
 */
function fontModules(names: string[]): SandpackFiles {
  const all = [...new Set([...DEFAULT_FONT_NAMES, ...names])];
  return {
    "/node_modules/next/font.js": fontModule("font", all),
    "/node_modules/next/font/google.js": fontModule("font", all),
    "/node_modules/next/font/local.js": fontModule("localFont", all),
  };
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
 *
 * The two sides are not in the same position, and that is the reason this list
 * has to be explicit about everything it does not already have. The published
 * build degrades an unknown `next/*` specifier to an empty module, so a
 * component importing `next/cache` renders; here `next` is never installed into
 * `node_modules` at all, so anything missing is a "Module not found" the author
 * cannot act on. Every module below is a real file, and each one is written to
 * degrade rather than to fail.
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
  // `fill` means "cover the nearest positioned ancestor", not "be a hundred
  // percent of the flow box". The shim used to size the `<img>` and leave it in
  // the layout, which pushed everything around it — and every shadcn hero,
  // avatar and cover is a `fill` image, so every one of them broke in the studio
  // and rendered fine published. Matched to `lib/preview/build.ts`.
  "/node_modules/next/image.js": `// \`placeholder="blur"\` has nothing to show until the image arrives. Next
// generates that from a tiny inline SVG when the project did not supply a
// \`blurDataURL\`; without one the frame renders as an empty box the size of the
// image, which is what it looked like here.
const BLUR_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' fill='%23e5e7eb'/%3E%3C/svg%3E";

export default function Image({
  src,
  alt = "",
  width,
  height,
  fill,
  priority,
  placeholder,
  blurDataURL,
  className,
  style,
  ...rest
}) {
  const resolved = typeof src === "string" ? src : src?.src;
  const box = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%" }
    : {};
  const preview =
    placeholder === "blur"
      ? {
          backgroundImage: \`url("\${blurDataURL ?? BLUR_PLACEHOLDER}")\`,
          backgroundSize: "cover",
        }
      : {};
  return (
    <img
      src={resolved}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={{ ...box, ...preview, ...style }}
      {...rest}
    />
  );
}
`,
  // Next takes an object href for a localized or prefetched route. The plain
  // anchor can only follow `pathname`, which is what the published build does —
  // dropping it to "#" meant every nav link pointed nowhere.
  "/node_modules/next/link.js": `export default function Link({ href = "#", children, ...rest }) {
  return (
    <a href={typeof href === "string" ? href : href?.pathname ?? "#"} {...rest}>
      {children}
    </a>
  );
}
`,
  "/node_modules/next/router.js": `import { createContext, useContext } from "react";

const router = {
  pathname: "/",
  query: {},
  asPath: "/",
  push() {},
  replace() {},
  refresh() {},
  prefetch() {},
  back() {},
  forward() {},
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
  // The two ways a Server Component leaves its render. Neither has anything to
  // do in a preview — there is no router behind it — but leaving them out meant
  // a component calling one crashed instead of rendering, and the published
  // build answers both.
  "/node_modules/next/navigation.js": `import { useRouter, usePathname, useSearchParams, useParams } from "./router";

export { useRouter, usePathname, useSearchParams, useParams };

export function redirect() {}

export function notFound() {
  throw new Error("notFound() is not available in a preview.");
}
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
  "/node_modules/next/font.js": DEFAULT_FONT_SHIM,
  "/node_modules/next/font/google.js": DEFAULT_FONT_SHIM,
  "/node_modules/next/font/local.js": DEFAULT_LOCAL_FONT_SHIM,
  "/node_modules/next/document.js": `export default function Document() {
  return null;
}
`,
  // -- the rest of the App Router -------------------------------------------
  // None of these run in a preview. All of them are imported by something that
  // does — a route handler, a layout, an error boundary — and a module the
  // bundler cannot resolve stops the whole compile, not just the file that
  // asked for it.

  "/node_modules/next/server.js": `// An App Router route handler answers with \`NextResponse.json()\`. The
// handler is never fetched by a preview, but the module is imported at module
// scope by the route file, so it has to load.
export const NextResponse = {
  json(body, init) {
    return new Response(JSON.stringify(body), {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  },
  redirect(url, status = 307) {
    return new Response(null, { status, headers: { location: String(url) } });
  },
  rewrite() {
    return new Response(null, { status: 200 });
  },
};

export function NextRequest(input, init) {
  return new Request(input, init);
}

export function userAgent() {
  return { isBot: false, ua: "", browser: {}, device: {}, engine: {}, os: {}, cpu: {} };
}
`,
  "/node_modules/next/headers.js": `// Async in the App Router, so a component that \`await\`s one has to get an
// object back rather than a module it cannot find. There is no request behind a
// preview, so the store is empty rather than absent.
export async function headers() {
  return new Headers();
}

export async function cookies() {
  const store = new Map();
  return {
    get: (name) => store.get(name),
    getAll: () => [...store.values()],
    has: (name) => store.has(name),
    set: (name, value) => store.set(name, { name, value }),
    delete: (name) => store.delete(name),
  };
}

export async function draftMode() {
  return { isEnabled: false, enable() {}, disable() {} };
}
`,
  "/node_modules/next/cache.js": `// Every revalidation call is a no-op: a preview has no server to
// invalidate and no cache to read. What matters is that the names exist, so an
// action or route that calls one renders instead of failing to compile.
export function revalidatePath() {}
export function revalidateTag() {}
export function unstable_expirePath() {}
export function unstable_expireTag() {}
export function unstable_noStore() {}
export function cacheTag() {}
export function cacheLife() {}
export function unstable_cache(fn) {
  return fn;
}
`,
  "/node_modules/next/after.js": `// Schedules work for after the response is sent. There is no response to
// send here, so the task runs now and its failure is swallowed rather than
// taken out on the page.
export function after(task) {
  try {
    const result = typeof task === "function" ? task() : task;
    if (result && typeof result.catch === "function") result.catch(() => {});
  } catch {
    // A background task that throws cannot take the preview down with it.
  }
}
`,
  "/node_modules/next/og.js": `// Only ever used by an \`opengraph-image\` route, which a preview never
// fetches. The binding exists so importing the module resolves.
export function ImageResponse() {}
export default ImageResponse;
`,
  "/node_modules/next/error.js": `// A project may import the boundary to render its own error state, and
// \`undefined\` is not a component — so the shape of the state is kept.
export default function ErrorPage({ statusCode, title }) {
  return <div>{title ?? (statusCode ? \`Error \${statusCode}\` : "Something went wrong.")}</div>;
}
export { ErrorPage as Error };
`,
  "/node_modules/next/not-found.js": `export default function NotFound() {
  return <div>404 — This page could not be found.</div>;
}
`,
  "/node_modules/next/global-error.js": `// Replaces the root layout when a render throws. Nothing in a preview can
// throw into it; it is here so a project that imports it loads.
export default function GlobalError() {
  return <div>Something went wrong.</div>;
}
`,
  "/node_modules/next/constants.js": `// Build-phase constants, spelled the same as Next spells them. Nothing in a
// preview is in any of the phases, but a config file that branches on one still
// has to be able to read it.
export const PHASE_DEVELOPMENT_SERVER = "phase-development-server";
export const PHASE_PRODUCTION_BUILD = "phase-production-build";
export const PHASE_PRODUCTION_SERVER = "phase-production-server";
export const PHASE_EXPORT = "phase-export";
export const PHASE_TEST = "phase-test";
export const PAGES_MANIFEST = "pages-manifest.json";
export const BUILD_MANIFEST = "build-manifest.json";
`,
  // `client-only` and `server-only` exist so that importing the wrong one is a
  // build error: the bundler swaps both for an empty module in a browser build,
  // which is what the published build does here. Nothing is ever read off them
  // — they are side-effect imports — so an empty module is the whole behaviour.
  "/node_modules/client-only/package.json": `{
  "name": "client-only",
  "version": "0.0.0",
  "main": "index.js"
}
`,
  "/node_modules/client-only/index.js": `export default {};
`,
  "/node_modules/server-only/package.json": `{
  "name": "server-only",
  "version": "0.0.0",
  "main": "index.js"
}
`,
  "/node_modules/server-only/index.js": `export default {};
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
   * The font modules, for the fonts this project actually imports.
   *
   * `next/font/google` exports one binding per Google font, so the shim is
   * generated per project rather than fixed — the published build does the same
   * from the same imports (`fontShim` in `lib/preview/build.ts`). Read before
   * the rewrite because `rewriteImports` leaves a bare `next/font/google`
   * specifier alone, so either pass sees the same statements.
   */
  const fonts = fontModules(collectFontNames(Object.values(normalized)));

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
      ...fonts,
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
