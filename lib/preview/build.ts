import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { build as esbuild, type Plugin } from "esbuild";

import { compileProjectCss } from "./tailwind";
import { resolveEntryPage } from "./entry";
import { splitRadixImports } from "./radix";
import { sandboxPackageVersion } from "../studio/deps";

/**
 * The publish build.
 *
 * This is a real build, not a runtime renderer: the project is bundled with
 * esbuild — imports resolved, dependencies included, output minified — and the
 * stylesheet is compiled by Tailwind, both once, on the server. The result is a
 * single self-contained HTML document that the marketplace then serves
 * statically, so a published component costs nothing to view.
 */

export type BuildFile = { path: string; content: string };

export { PREVIEW_BUILD_VERSION } from "./version";

export type BuildResult = {
  /** The complete, self-contained document. */
  html: string;
  /** Content hash — the same project always builds to the same hash. */
  hash: string;
  /** Packages left to the import map because they are not installed here. */
  externals: string[];
  /**
   * The import map the document ships, specifier to CDN URL.
   *
   * Returned rather than left inside the HTML because it is the document's
   * entire external network surface: a caller that wants to know whether the
   * preview will actually load — or wants to warm it — needs the URLs, not the
   * blob they are embedded in.
   */
  imports: Record<string, string>;
  /** The compiled stylesheet, for callers that want it separately. */
  css: string;
  /** The bundled JavaScript, for callers that want it separately. */
  js: string;
};

export class BuildError extends Error {
  file?: string;
  line?: number;
  column?: number;

  constructor(message: string, location?: { file?: string; line?: number; column?: number }) {
    super(message);
    this.name = "BuildError";
    this.file = location?.file;
    this.line = location?.line;
    this.column = location?.column;
  }
}

/* --------------------------------------------------------------- shims -- */

/**
 * Next.js APIs a component may reach for. A published component renders in a
 * plain browser, so each one is replaced by the nearest equivalent instead of
 * failing the build.
 *
 * Exported so the coverage test can hold this list and the sandbox's
 * (`lib/studio/sandpack`) to the same set: `next/form` was missing from both,
 * and nothing noticed until a registry example imported it.
 */
export const NEXT_SHIMS: Record<string, string> = {
  "next/image": `import React from "react";
const Image = ({ src, alt, width, height, fill, priority, className, style, ...rest }) =>
  React.createElement("img", {
    src: typeof src === "string" ? src : src && src.src,
    alt: alt || "",
    width,
    height,
    className,
    style: fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style } : style,
    ...rest,
  });
export default Image;`,

  "next/link": `import React from "react";
const Link = ({ href, children, className, style, ...rest }) =>
  React.createElement("a", {
    href: typeof href === "string" ? href : (href && href.pathname) || "#",
    className,
    style,
    ...rest,
  }, children);
export default Link;`,

  // `next/form` is a `<form>` whose `action` may be a server action. React 19
  // already runs a function `action` itself, so the shim is the element the
  // component expected — dropping it instead made `<Form>` render as
  // `undefined` and took the whole preview down with it.
  "next/form": `import React from "react";
const Form = ({ children, ...rest }) => React.createElement("form", rest, children);
export { Form };
export default Form;`,

  "next/navigation": `export function usePathname() { return "/"; }
export function useSearchParams() { return new URLSearchParams(); }
export function useParams() { return {}; }
export function useRouter() {
  return { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
}
export function redirect() {}
export function notFound() { throw new Error("notFound() is not available in a preview."); }`,

  "next/router": `export function useRouter() {
  return { pathname: "/", route: "/", query: {}, asPath: "/", push() {}, replace() {}, back() {}, prefetch() {} };
}
export default useRouter;`,

  "next/head": `export default function Head() { return null; }`,
  "next/script": `export default function Script() { return null; }`,
  "next/document": `export default function Document() { return null; }`,

  "next/dynamic": `import React, { Suspense } from "react";
export default function dynamic(loader, options = {}) {
  const Lazy = React.lazy(loader);
  const Fallback = options.loading || (() => null);
  return function Dynamic(props) {
    return React.createElement(
      Suspense,
      { fallback: React.createElement(Fallback) },
      React.createElement(Lazy, props)
    );
  };
}`,

  "client-only": `export default {};`,
  "server-only": `export default {};`,
};

const EMPTY_MODULE = "export default {};";

/** Named font helpers imported anywhere in the project. */
function fontShim(file: string, names: string[]): string {
  return names
    .map((name) => {
      const variable = `--font-${name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`;
      return `export const ${name} = () => ({ className: "", variable: "${variable}", style: { fontFamily: "inherit" } });`;
    })
    .join("\n");
}

const FONT_IMPORT_RE =
  /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*["']next\/font\/(?:google|local)["']/g;

function collectFontNames(files: BuildFile[]): string[] {
  const names = new Set<string>();
  for (const file of files) {
    for (const match of file.content.matchAll(FONT_IMPORT_RE)) {
      for (const raw of match[1].split(",")) {
        const name = raw.trim().split(/\s+as\s+/)[0].trim();
        if (name) names.add(name);
      }
    }
  }
  return [...names];
}

/* ------------------------------------------------------------- bundling -- */

function packageRoot(specifier: string): string {
  if (specifier.startsWith("@")) return specifier.split("/").slice(0, 2).join("/");
  return specifier.split("/")[0];
}

function shimPlugin(fontNames: string[]): Plugin {
  const builtins = new Set([
    "fs",
    "path",
    "os",
    "crypto",
    "util",
    "stream",
    "events",
    "buffer",
    "http",
    "https",
    "net",
    "url",
    "zlib",
    "child_process",
    "worker_threads",
  ]);

  return {
    name: "shadway-shims",
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /^next\// }, (args) => {
        if (args.path.startsWith("next/font/")) {
          return { path: args.path, namespace: "shadway-shim" };
        }
        return NEXT_SHIMS[args.path]
          ? { path: args.path, namespace: "shadway-shim" }
          : { path: args.path, namespace: "shadway-empty" };
      });

      pluginBuild.onResolve({ filter: /^(client-only|server-only)$/ }, (args) => ({
        path: args.path,
        namespace: "shadway-shim",
      }));

      // Node builtins have no place in a browser bundle.
      pluginBuild.onResolve({ filter: /^(node:)?[a-z_]+$/ }, (args) => {
        if (isBuiltin(args.path, builtins)) {
          return { path: args.path, namespace: "shadway-empty" };
        }
        return undefined;
      });

      pluginBuild.onLoad({ filter: /.*/, namespace: "shadway-shim" }, (args) => {
        if (args.path.startsWith("next/font/")) {
          return { contents: fontShim(args.path, fontNames), loader: "js", resolveDir: process.cwd() };
        }
        return {
          contents: NEXT_SHIMS[args.path] ?? EMPTY_MODULE,
          loader: "js",
          resolveDir: process.cwd(),
        };
      });

      pluginBuild.onLoad({ filter: /.*/, namespace: "shadway-empty" }, () => ({
        contents: EMPTY_MODULE,
        loader: "js",
      }));
    },
  };
}

function isBuiltin(name: string, builtins: Set<string>): boolean {
  return builtins.has(name.replace(/^node:/, ""));
}

/* ------------------------------------------------------------ the entry -- */

const ENTRY_FILE = "__entry.tsx";

function entrySource(demoPath: string): string {
  const relative = demoPath.replace(/^\//, "").replace(/\.(tsx?|jsx?)$/, "");
  return `import React from "react";
import { createRoot } from "react-dom/client";
import Demo from "./${relative}";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    React.createElement(React.StrictMode, null, React.createElement(Demo))
  );
}
`;
}

/**
 * The React version the bundle is compiled against, read from disk so the copy
 * the CDN serves is the same library the component was built with.
 */
function installedVersion(name: string): string {
  try {
    const raw = fsSync.readFileSync(
      path.join(process.cwd(), "node_modules", name, "package.json"),
      "utf8"
    );
    return (JSON.parse(raw) as { version?: string }).version ?? "19";
  } catch {
    return "19";
  }
}

const REACT_VERSION = installedVersion("react");
const REACT_DOM_VERSION = installedVersion("react-dom");

/**
 * React itself, externalised the moment anything else is.
 *
 * A package served from a CDN imports `react` by name. If the bundle kept its
 * own copy, that package would be handed a second React and every hook it
 * calls would throw. So as soon as one package needs the CDN, React moves to
 * the same CDN and both sides share one copy. A component that resolves
 * entirely from `node_modules` never pays for this: it stays self-contained.
 */
const REACT_EXTERNALS = ["react", "react-dom"];

/**
 * The import map for whatever the build could not resolve.
 *
 * Keys are the specifiers the code wrote — `react-icons/fa6`, not
 * `react-icons` — because an import map matches text, not packages. Each
 * package also gets a trailing-slash entry so a subpath esbuild never saw
 * still resolves. `external=react,react-dom` keeps the CDN copies from
 * bundling a React of their own.
 *
 * Every specifier this platform has an opinion about carries that opinion into
 * the URL. Without it there are two different previews of the same component:
 * the studio installs what `SANDBOX_PACKAGE_VERSIONS` pins, and the published
 * document loaded whatever esm.sh considered newest on the day it was viewed —
 * so a package that shipped a breaking major in between would look fine while
 * the author was editing and break for every reader afterwards. The pinned
 * range is exactly what npm would install, so the CDN resolves to the same
 * version the sandbox did. A package with no entry here was never pinned for
 * the sandbox either, and both sides take `latest`.
 */
function importMapFor(externals: string[]): Record<string, string> {
  if (externals.length === 0) return {};

  const at = (name: string) => {
    const version = sandboxPackageVersion(name);
    return version === "latest" ? name : `${name}@${version.replace(/^\^/, "%5E").replace(/^~/, "%7E")}`;
  };

  const imports: Record<string, string> = {
    react: `https://esm.sh/react@${REACT_VERSION}`,
    "react/": `https://esm.sh/react@${REACT_VERSION}/`,
    "react/jsx-runtime": `https://esm.sh/react@${REACT_VERSION}/jsx-runtime`,
    "react/jsx-dev-runtime": `https://esm.sh/react@${REACT_VERSION}/jsx-dev-runtime`,
    "react-dom": `https://esm.sh/react-dom@${REACT_DOM_VERSION}?external=react`,
    "react-dom/": `https://esm.sh/react-dom@${REACT_DOM_VERSION}/`,
    "react-dom/client": `https://esm.sh/react-dom@${REACT_DOM_VERSION}/client?external=react`,
  };

  for (const specifier of externals) {
    const root = packageRoot(specifier);
    imports[specifier] ??= `https://esm.sh/${at(specifier)}?external=react,react-dom`;
    imports[root] ??= `https://esm.sh/${at(root)}?external=react,react-dom`;
    imports[`${root}/`] ??= `https://esm.sh/${at(root)}/`;
  }

  return imports;
}

/**
 * Reports a failure inside the frame instead of leaving a white rectangle.
 *
 * A module that cannot be resolved throws before React ever mounts, and a
 * blank pane says nothing about why. The listener is registered in the capture
 * phase because a dependency that fails to *load* fires on the script element
 * and never bubbles up to `window` — the throw and the 404 have to be caught
 * the same way. The overlay only appears when the root is still empty a beat
 * after the error, so a component that renders and merely logs something is
 * never covered up.
 */
const ERROR_REPORT = `<div id="shadway-preview-error" hidden>
<p><strong>This preview could not start.</strong></p>
<pre></pre>
</div>
<style>
#shadway-preview-error{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;gap:10px;justify-content:center;padding:28px;background:#fff;color:#b91c1c;font:12px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace}
#shadway-preview-error[hidden]{display:none}
#shadway-preview-error p{margin:0;font:600 13px/1.5 system-ui,sans-serif}
#shadway-preview-error pre{margin:0;white-space:pre-wrap;word-break:break-word;color:#7f1d1d}
</style>
<script>
(function () {
  var message = null;
  function describe(event) {
    if (!event) return "Unknown error";
    if (event.message) return String(event.message);
    if (event.error) return String(event.error);
    var target = event.target;
    if (target && target.src) return "Failed to load " + target.src;
    if (target && target.href) return "Failed to load " + target.href;
    return "A dependency could not be loaded, so the preview never mounted.";
  }
  function report(event) {
    if (message === null) message = describe(event);
    window.setTimeout(function () {
      var box = document.getElementById("shadway-preview-error");
      var root = document.getElementById("root");
      if (!box || !message) return;
      if (root && root.childElementCount > 0) return;
      box.hidden = false;
      box.querySelector("pre").textContent = message;
    }, 800);
  }
  window.addEventListener("error", report, true);
  window.addEventListener("unhandledrejection", function (event) {
    report({ error: (event && event.reason) || "Unknown error" });
  });
})();
</script>`;

function documentShell(js: string, css: string, imports: Record<string, string>, theme: "light" | "dark", title: string): string {
  const hasImports = Object.keys(imports).length > 0;

  return `<!DOCTYPE html>
<html lang="en" class="${theme === "dark" ? "dark" : ""}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title.replace(/[<>&]/g, "")}</title>
<style>${css}</style>
<style>html,body{height:100%}body{margin:0}</style>
${
  hasImports
    ? `<script type="importmap">${JSON.stringify({ imports }).replace(/</g, "\\u003c")}</script>`
    : ""
}
</head>
<body>
<div id="root"></div>
${ERROR_REPORT}
<script type="module">${js.replace(/<\/script>/g, "<\\/script>")}</script>
</body>
</html>`;
}

/* ---------------------------------------------------------------- build -- */

function normalize(pathname: string): string {
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

export async function buildComponentBundle(
  files: BuildFile[],
  options: { entry?: string; theme?: "light" | "dark"; title?: string } = {}
): Promise<BuildResult> {
  const project: BuildFile[] = files.map((file) => ({
    path: normalize(file.path),
    // `import { Dialog } from "radix-ui"` costs the whole Radix suite in
    // resolve-and-parse before tree-shaking throws 35 of the 36 packages away
    // again — see `lib/preview/radix.ts`. Splitting it here covers files that
    // were written or stored before the transform existed; the vendored
    // registry sources arrive already split.
    content: splitRadixImports(file.content),
  }));

  const demoPath = resolveEntryPage(project, options.entry);

  if (!demoPath || !project.some((file) => file.path === demoPath)) {
    throw new BuildError("This project has no page to build — add a demo file.");
  }

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shadway-build-"));
  const nodeModules = path.join(process.cwd(), "node_modules");

  try {
    for (const file of project) {
      const target = path.join(dir, file.path.replace(/^\//, ""));
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.content, "utf8");
    }

    await fs.writeFile(
      path.join(dir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            jsx: "react-jsx",
            baseUrl: ".",
            paths: { "@/*": ["./*"] },
            target: "ES2020",
            moduleResolution: "bundler",
            esModuleInterop: true,
          },
        },
        null,
        2
      ),
      "utf8"
    );

    await fs.writeFile(path.join(dir, ENTRY_FILE), entrySource(demoPath), "utf8");

    const styleCode = project.find((file) => file.path === "/app/globals.css")?.content
      ?? project.find((file) => file.path.endsWith(".css"))?.content;

    const css = await compileProjectCss(project, styleCode);
    const fontNames = collectFontNames(project);

    // A package that is not installed here cannot be bundled, but it is not a
    // build failure either: it is left external and handed to the import map,
    // which pulls it from a CDN at view time. esbuild reports every unresolved
    // specifier at once, so the build retries with those marked external —
    // and, from the second attempt on, with React external alongside them so
    // the CDN copy and the bundle share one React.
    const externals = new Set<string>();
    let output: Awaited<ReturnType<typeof esbuild>> | null = null;

    for (let attempt = 0; attempt < 5 && !output; attempt += 1) {
      const external = [
        ...externals,
        ...(externals.size ? REACT_EXTERNALS : []),
      ];

      try {
        output = await esbuild({
          absWorkingDir: dir,
          entryPoints: [ENTRY_FILE],
          bundle: true,
          write: false,
          format: "esm",
          platform: "browser",
          target: ["es2020"],
          jsx: "automatic",
          minify: true,
          legalComments: "none",
          logLevel: "silent",
          tsconfig: path.join(dir, "tsconfig.json"),
          nodePaths: [nodeModules],
          external,
          define: { "process.env.NODE_ENV": '"production"' },
          loader: { ".css": "empty" },
          plugins: [shimPlugin(fontNames)],
        });
      } catch (error) {
        const unresolved = unresolvedBareSpecifiers(error);
        const fresh = unresolved.filter((name) => !externals.has(name));
        if (fresh.length === 0) throw toBuildError(error, dir);
        for (const name of fresh) externals.add(name);
      }
    }

    if (!output) throw new BuildError("The build did not finish.");

    const js = output.outputFiles?.[0]?.text ?? "";
    if (!js.trim()) throw new BuildError("The build produced no output.");

    const externalList = [
      ...externals,
      ...(externals.size ? REACT_EXTERNALS : []),
    ].sort();
    const hash = crypto
      .createHash("sha1")
      .update(JSON.stringify({ js, css, externals: externalList }))
      .digest("hex")
      .slice(0, 16);

    const imports = importMapFor(externalList);

    const html = documentShell(
      js,
      css,
      imports,
      options.theme ?? "light",
      options.title ?? "Component preview"
    );

    return { html, hash, externals: externalList, imports, css, js };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** The bare packages esbuild could not resolve, taken from its error output. */
function unresolvedBareSpecifiers(error: unknown): string[] {
  const failure = error as { errors?: { text?: string }[] };
  const out = new Set<string>();

  for (const item of failure?.errors ?? []) {
    const match = /Could not resolve "([^"]+)"/.exec(item.text ?? "");
    if (!match) continue;

    const specifier = match[1];
    if (
      specifier.startsWith(".") ||
      specifier.startsWith("/") ||
      specifier.startsWith("@/")
    ) {
      continue;
    }

    // The whole specifier, not its package root: `react-icons/fa6` is a
    // different module from `react-icons`, and an import map only matches what
    // the code actually wrote.
    out.add(specifier);
  }

  return [...out];
}

/** esbuild reports every failure at once; the first one is what the author sees. */
function toBuildError(error: unknown, dir: string): BuildError {
  const failure = error as {
    errors?: { text: string; location?: { file: string; line: number; column: number } }[];
    message?: string;
  };

  const first = failure?.errors?.[0];
  if (!first) return new BuildError(failure?.message ?? "The build failed.");

  const file = first.location?.file
    ? path.relative(dir, first.location.file).split(path.sep).join("/")
    : undefined;

  return new BuildError(first.text, {
    file,
    line: first.location?.line,
    column: first.location?.column,
  });
}
