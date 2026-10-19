import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import { builtinModules } from "node:module";
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

/**
 * The fonts every project gets whether it asked for them or not.
 *
 * `next/font/google` exports one binding per Google font and there are
 * thousands of them, so generating only the names this project's own imports
 * can be collected from leaves two holes. A `import * as fonts from
 * "next/font/google"` collects no names at all — the shape is a namespace, not
 * a list — and a font reached through a re-export is never seen by any regex
 * that only looks at import statements. Both land as `fonts.Inter is not a
 * function` at render time, in a document that built without complaint.
 *
 * The floor exists on the sandbox side for the same reason, and the two lists
 * are held to each other by `next-font.test.ts` rather than by a shared export:
 * the sandbox list cannot be moved into a module both sides import without
 * `lib/studio` growing a dependency it does not have today.
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

/** The binding each entry point's default export is called. */
function fontBinding(specifier: string): string {
  return specifier === "next/font/local" ? "localFont" : "font";
}

/**
 * Named font helpers for one project.
 *
 * The module is `const <binding>; export default <binding>;` plus one export
 * per font, which is the shape Next actually has and the shape the sandbox
 * writes. It used to be the last part alone, and that broke two things:
 *
 *   `import localFont from "next/font/local"` has no default to bind, so the
 *   generated file had no export of that name at all. esbuild accepts an empty
 *   module for a default import (it reads it as CommonJS and hands back
 *   `module.exports`, i.e. `{}`), so the build passed and `localFont()` threw
 *   `is not a function` in every reader's browser.
 *
 *   `import { Geist } from "next/font"` — the bare entry point, no `/google`,
 *   no `/local` — was not recognised as a font module at all. It missed the
 *   `next/font/` prefix test and was sent to the empty-module fallback, and a
 *   named import from an empty module is a hard failure:
 *
 *     No matching export in "shadway-empty:next/font" for import "Geist"
 *
 *   so the publish build *refused the component outright* while the sandbox
 *   rendered it perfectly. That is the whole failure this corrects: a component
 *   that works in the editor and cannot be published at all.
 */
function fontShim(specifier: string, names: string[]): string {
  const binding = fontBinding(specifier);

  const named = (name: string) => {
    const variable = `--font-${name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`;
    return `() => ({ className: "", variable: "${variable}", style: { fontFamily: "inherit" } })`;
  };

  return [
    `const ${binding} = ${named("--font-sans")};`,
    `export default ${binding};`,
    ...names.map((name) => `export const ${name} = ${named(name)};`),
  ].join("\n");
}

const FONT_IMPORT_RE =
  /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*["']next\/font(?:\/(?:google|local))?["']/g;

/** A name that survives collection but is not a binding is a syntax error. */
const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function collectFontNames(files: BuildFile[]): string[] {
  const names = new Set<string>();

  for (const file of files) {
    for (const match of file.content.matchAll(FONT_IMPORT_RE)) {
      for (const raw of match[1].split(",")) {
        // `{ Syne as Display }` wants `Syne`; `{ type Inter }` is a type; and
        // anything left over that is not an identifier would be a syntax error
        // in a module the author never wrote and cannot see — `import { default
        // as Inter }` collects the name `default` and produces `export const
        // default`, which stops the build with an error pointing at a file that
        // does not exist in their project.
        const name = raw
          .trim()
          .replace(/^type\s+/, "")
          .split(/\s+as\s+/)[0]
          .trim();

        if (IDENTIFIER_RE.test(name) && name !== "default") names.add(name);
      }
    }
  }

  return [...new Set([...DEFAULT_FONT_NAMES, ...names])];
}

/* ------------------------------------------------------------- bundling -- */

function packageRoot(specifier: string): string {
  if (specifier.startsWith("@")) return specifier.split("/").slice(0, 2).join("/");
  return specifier.split("/")[0];
}

/**
 * The Node builtins a browser bundle has no use for.
 *
 * Read from Node rather than spelled out here. The hand-written set this
 * replaced was a list of the modules that happen to appear in the vendored
 * shadcn sources, and every builtin it missed fell through to esbuild's
 * resolver — failed — and then to the *external* path, which is the path meant
 * for a package the author asked for by name:
 *
 *     import { strict as assert } from "assert";
 *
 * became an import map entry for `https://esm.sh/assert?external=react,react-dom`,
 * a package on npm that has nothing to do with Node's `assert`. And because a
 * single unresolved specifier is enough to drag `react` and `react-dom` out to
 * the CDN with it (`REACT_EXTERNALS` is added as soon as `externals` is
 * non-empty), one leftover Node import turned a self-contained document that
 * needed nothing into one that needs two network round trips — and a
 * cross-origin copy of React — before a single pixel appears.
 *
 * The `node:` spelling gets its own unconditional answer for the same reason:
 * it is a builtin by construction, so one this host's Node does not have is
 * still not an npm package, and `https://esm.sh/node:assert` 404s for everyone
 * who ever views the preview.
 */
const NODE_BUILTINS = new Set(
  builtinModules.flatMap((name) => {
    const bare = name.replace(/^node:/, "");
    return [bare, `node:${bare}`];
  })
);

/**
 * Bare specifiers that could name a Node builtin.
 *
 * Anchored so a scoped package (`@scope/thing`) is never even a candidate, and
 * written to admit the subpath builtins — `fs/promises`, `assert/strict`,
 * `timers/promises`, `dns/promises` — which the old filter's `[a-z_]+` could
 * not match at all, since a slash is not in its class. A two-segment npm specifier
 * like `lodash/fp` does match, and is then passed over by the membership test.
 */
const BUILTIN_SPECIFIER_RE = /^(?:node:)?[a-z0-9_]+(?:\/[a-z0-9_]+)*$/;

function shimPlugin(fontNames: string[]): Plugin {
  return {
    name: "shadway-shims",
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /^next\// }, (args) => {
        // `next/font` itself, with no `/google` or `/local` after it, is a real
        // entry point and used to miss this test and be answered with an empty
        // module — a hard "No matching export" for every font binding it had.
        if (args.path === "next/font" || args.path.startsWith("next/font/")) {
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
      pluginBuild.onResolve({ filter: BUILTIN_SPECIFIER_RE }, (args) => {
        if (!NODE_BUILTINS.has(args.path) && !args.path.startsWith("node:")) return undefined;
        return { path: args.path, namespace: "shadway-empty" };
      });

      pluginBuild.onLoad({ filter: /.*/, namespace: "shadway-shim" }, (args) => {
        if (args.path === "next/font" || args.path.startsWith("next/font/")) {
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

/**
 * Text that must not be able to end the element it is written into.
 *
 * `<style>` and `<script>` are raw-text elements: the HTML parser closes them
 * at `</style` and `</script` — case-insensitively, followed by whitespace, a
 * slash or `>` — and everything after that is markup again. Neither element
 * has an escape sequence, so the only move is to break the sequence in the
 * text, and the same break works for both because `\/` is a valid escape for
 * `/` in CSS *and* in JavaScript. The document reads identically and the value
 * the author wrote is unchanged.
 *
 * The stylesheet is the reachable one, and the route to it is not obvious.
 * Tailwind re-serialises the author's CSS through lightningcss, which *drops*
 * the sequence wherever it appears as syntax — a stray `</style>` between rules
 * is invalid CSS and simply vanishes — but *preserves it inside a string token*:
 *
 *     :root { --x: "</style><script>fetch("/api/me")</script>"; }
 *
 * compiled to CSS carrying that text verbatim, was concatenated into the
 * document between `<style>` tags, and put a working script into the head of a
 * page the marketplace serves from its own origin.
 *
 * The module script was escaped, but only against a lowercase `</script>`. HTML
 * does not care about case. esbuild's own output escaped the slash inside string
 * literals, which is why that has not bitten yet; relying on the minifier's
 * string-literal rules to be the only thing between an author and the parser
 * closing the element is not a defence.
 */
function rawTextSafe(text: string, tag: string): string {
  return text.replace(new RegExp(`</(${tag})`, "gi"), "<\\/$1");
}

/** Text content of an element, escaped rather than deleted. */
function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function documentShell(js: string, css: string, imports: Record<string, string>, theme: "light" | "dark", title: string): string {
  const hasImports = Object.keys(imports).length > 0;

  return `<!DOCTYPE html>
<html lang="en" class="${theme === "dark" ? "dark" : ""}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeText(title)}</title>
<style>${rawTextSafe(css, "style")}</style>
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
<script type="module">${rawTextSafe(js, "script")}</script>
</body>
</html>`;
}

/* ---------------------------------------------------------------- build -- */

/**
 * A project path that cannot reach outside the build directory.
 *
 * Every file in a project is written to disk with the author's own content and
 * its own path, and the path used to be joined straight onto the temporary
 * directory. That made the write arbitrary rather than confined:
 *
 *     path.join("/tmp/shadway-build-ab12", "../../../var/www/x")
 *
 * normalises to `/var/www/x`. A support file named `"/../../evil.tsx"` in a
 * publish request landed outside the sandbox, and the path is author-supplied
 * all the way down (`body.files[].path` -> `storedProjectPath`, which strips a
 * leading slash and nothing else, -> here). Escaping silently is worse than
 * rejecting: a rewritten path would let the build report success over a file
 * the author believes they wrote somewhere else. So `..` is refused outright, as
 * are absolute paths wearing a drive letter or a UNC share — both of which
 * `path.join` honours regardless of the prefix they are joined behind, and both
 * of which a project file has no business naming.
 *
 * Nothing legitimate is lost: a preview project has no use for `..`, a drive
 * letter or a NUL.
 */
function projectPath(raw: string): string {
  const source = String(raw ?? "");

  if (source.includes("\0")) {
    throw new BuildError(`"${source}" is not a usable file path.`);
  }

  // Windows separators too. An author on Windows writes `..\\..\\evil.tsx` in
  // the same field a Linux author writes `../../evil.tsx` in, and `path.join`
  // on the build host is the one that decides — so both spellings are checked.
  const segments: string[] = [];

  for (const segment of source.replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") continue;

    if (segment === ".." || /^[a-zA-Z]:/.test(segment)) {
      throw new BuildError(
        `"${source}" points outside the project. File paths are read from the project root — ` +
          `use "components/thing.tsx", not a path that walks out of it.`
      );
    }

    segments.push(segment);
  }

  if (!segments.length) {
    throw new BuildError(`"${source}" is not a usable file path.`);
  }

  return `/${segments.join("/")}`;
}

/**
 * How much of itself a published component is allowed to be.
 *
 * `previewHtml` is not just served, it is *stored*: the route writes it onto the
 * component's own record. So every one of these is a limit on a value that ends
 * up in a response body and in a BSON document, and the document limit is the
 * one that bites hardest — Mongo refuses anything past 16 MB, and the refusal
 * lands *after* the component row has already been inserted, so the component
 * exists, can never store a preview, and re-runs a full esbuild + Tailwind
 * build on every single view in a permanent 500.
 *
 * The headroom is large on purpose. The largest thing this build is handed in
 * normal use is a shadcn dashboard block with the vendored `ui` sources
 * attached — a few hundred files and a couple of hundred kilobytes. Every limit
 * here is an order of magnitude above that, so the only projects these stop are
 * the ones nobody was ever going to view.
 */
const LIMITS = {
  /** A project with more files than this is a data drop, not a component. */
  files: 400,
  /** No single source file. */
  fileBytes: 512 * 1024,
  /** The author's own sources together, vendored shadcn files included. */
  sourceBytes: 8 * 1024 * 1024,
  /** The compiled stylesheet, injected into the document as one `<style>`. */
  cssBytes: 2 * 1024 * 1024,
  /** The bundled JavaScript. */
  jsBytes: 8 * 1024 * 1024,
  /**
   * The finished document. Under 16 MB because that is where Mongo stops, and
   * `previewHtml` shares its record with the author's source and project files.
   */
  documentBytes: 12 * 1024 * 1024,
};

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Fails the build with something the author can act on, before it ships. */
function enforce(what: string, actual: number, limit: number, advice: string): void {
  if (actual <= limit) return;

  throw new BuildError(
    `This component is too large to publish — ${what} is ${megabytes(actual)}, ` +
      `over the ${megabytes(limit)} limit. ${advice}`
  );
}

export async function buildComponentBundle(
  files: BuildFile[],
  options: { entry?: string; theme?: "light" | "dark"; title?: string } = {}
): Promise<BuildResult> {
  /**
   * Normalised and counted before anything is written.
   *
   * The order matters: a path that escapes the project is rejected here, before
   * the temporary directory exists and before a single byte of an author's
   * content has been put on disk. Doing it in the write loop instead — which is
   * where the check used to be absent — means the check has to be correct in
   * the presence of everything already written, and the first file processed is
   * the one that escapes.
   */
  let sourceBytes = 0;
  const project: BuildFile[] = [];

  for (const file of files) {
    const content = splitRadixImports(file.content);
    const size = Buffer.byteLength(content, "utf8");

    enforce(`one file`, size, LIMITS.fileBytes, "Split it, or trim what it inlines.");
    sourceBytes += size;

    project.push({
      path: projectPath(file.path),
      // `import { Dialog } from "radix-ui"` costs the whole Radix suite in
      // resolve-and-parse before tree-shaking throws 35 of the 36 packages away
      // again — see `lib/preview/radix.ts`. Splitting it here covers files that
      // were written or stored before the transform existed; the vendored
      // registry sources arrive already split.
      content,
    });
  }

  enforce(
    "the project",
    project.length,
    LIMITS.files,
    "A component is a component, not a data drop."
  );
  enforce(
    "the project",
    sourceBytes,
    LIMITS.sourceBytes,
    "Drop the vendored or generated files that a real component does not need."
  );

  const demoPath = resolveEntryPage(project, options.entry);

  if (!demoPath || !project.some((file) => file.path === demoPath)) {
    throw new BuildError("This project has no page to build — add a demo file.");
  }

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shadway-build-"));
  const nodeModules = path.join(process.cwd(), "node_modules");

  try {
    /**
     * The write is confined to `dir` by construction now, not by a test: every
     * path is a `/`-prefixed run of ordinary segments that `projectPath` has
     * already cleared of `..`, drive letters and NULs, so `path.join` cannot
     * produce anything outside it.
     */
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
    enforce(
      "the compiled stylesheet",
      Buffer.byteLength(css, "utf8"),
      LIMITS.cssBytes,
      "It ships inside the document, and Tailwind emits a rule per distinct utility it sees."
    );

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

    enforce(
      "the bundle",
      Buffer.byteLength(js, "utf8"),
      LIMITS.jsBytes,
      "Something in the dependency chain is pulling in a library rather than a component."
    );

    const externalList = [
      ...externals,
      ...(externals.size ? REACT_EXTERNALS : []),
    ].sort();

    const imports = importMapFor(externalList);

    const html = documentShell(
      js,
      css,
      imports,
      options.theme ?? "light",
      options.title ?? "Component preview"
    );

    enforce(
      "the preview document",
      Buffer.byteLength(html, "utf8"),
      LIMITS.documentBytes,
      "It is stored on the component's record, so it has to stay inside the size a document can be."
    );

    /**
     * The hash is taken over the finished document, not over its parts.
     *
     * It used to be `sha1({ js, css, externals })`, which is a hash of the
     * bundle — and the bundle is not the document. The theme decides the class
     * on `<html>` and the title goes in `<title>`, so `build(files, { theme:
     * "light" })` and `build(files, { theme: "dark" })` produced two different
     * documents carrying one identical hash, which is then stored as
     * `previewHash` and handed out as the `ETag` of `/api/components/preview`.
     * A visitor who had the light frame cached was answered `304 Not Modified`
     * for the dark one and kept looking at the wrong theme, with no error
     * anywhere to explain it. A content hash that is not a hash of the content
     * is worse than none, because everything downstream trusts it.
     */
    const hash = crypto
      .createHash("sha1")
      .update(html)
      .digest("hex")
      .slice(0, 16);

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
