import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { build as esbuild, type Plugin } from "esbuild";

import { compileProjectCss } from "./tailwind";

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

export type BuildResult = {
  /** The complete, self-contained document. */
  html: string;
  /** Content hash — the same project always builds to the same hash. */
  hash: string;
  /** Packages left to the import map because they are not installed here. */
  externals: string[];
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
 */
const NEXT_SHIMS: Record<string, string> = {
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

function documentShell(js: string, css: string, externals: string[], theme: "light" | "dark", title: string): string {
  const imports = Object.fromEntries(
    externals.map((name) => [name, `https://esm.sh/${name}?external=react,react-dom`])
  );

  return `<!DOCTYPE html>
<html lang="en" class="${theme === "dark" ? "dark" : ""}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title.replace(/[<>&]/g, "")}</title>
<style>${css}</style>
<style>html,body{height:100%}body{margin:0}</style>
${
  externals.length
    ? `<script type="importmap">${JSON.stringify({ imports }).replace(/</g, "\\u003c")}</script>`
    : ""
}
</head>
<body>
<div id="root"></div>
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
    content: file.content,
  }));

  const demoPath =
    options.entry ??
    (project.some((file) => file.path === "/app/page.tsx")
      ? "/app/page.tsx"
      : project.find((file) => file.path.endsWith(".tsx"))?.path);

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
    // specifier at once, so the build retries with those marked external.
    const externals = new Set<string>();
    let output: Awaited<ReturnType<typeof esbuild>> | null = null;

    for (let attempt = 0; attempt < 4 && !output; attempt += 1) {
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
          external: [...externals],
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

    const externalList = [...externals].sort();
    const hash = crypto
      .createHash("sha1")
      .update(JSON.stringify({ js, css, externals: externalList }))
      .digest("hex")
      .slice(0, 16);

    const html = documentShell(
      js,
      css,
      externalList,
      options.theme ?? "light",
      options.title ?? "Component preview"
    );

    return { html, hash, externals: externalList, css, js };
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

    const pkg = packageRoot(specifier);
    if (pkg) out.add(pkg);
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
