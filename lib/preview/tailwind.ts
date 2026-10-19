import fs from "node:fs/promises";
import path from "node:path";
import { compile } from "tailwindcss";

import { PREVIEW_THEME_CSS } from "./theme.generated";
import { withShadcnFiles, type PreviewFileInput } from "./shadcn-ui";

/**
 * Compiles a project's Tailwind stylesheet on the server.
 *
 * Both the studio preview and the publish build use this: the editor gets a
 * plain stylesheet instead of shipping the Tailwind browser runtime into the
 * sandbox, and the published artifact carries precompiled CSS instead of a
 * megabyte of JIT that runs on every visit.
 *
 * The stylesheet is compiled for real — Tailwind parses the project's own
 * `globals.css` (its `@import "tailwindcss"`, `@theme` block and `@apply`
 * layers included) and only the utilities that actually appear in the sources
 * are generated.
 */

export type CssSourceFile = { path: string; content: string };

/**
 * Characters a candidate never begins with.
 *
 * `[` is deliberately not in here. It opens an arbitrary variant
 * (`[&>svg]:size-4`, `[@media(min-width:900px)]:grid`) or an arbitrary property
 * (`[mask-type:luminance]`), both of which start a candidate with it — so
 * skipping it at the start ate the bracket and handed Tailwind the tail
 * (`&>svg]:size-4`), which it then quietly dropped. Across the vendored
 * shadcn sources alone that is 137 distinct utilities that were simply never
 * generated, with no error anywhere: a sidebar, an avatar and a hero all
 * rendering slightly wrong for a reason nothing reported.
 */
const CANDIDATE_SKIP = new Set([
  "{",
  "}",
  "(",
  ")",
  ",",
  ";",
  ":",
  "=",
  "+",
  "|",
  "<",
  ">",
  "`",
  '"',
  "'",
]);

/**
 * Tailwind's own extractor, reproduced.
 *
 * A candidate is a run of text that ends at whitespace, except inside a `[...]`
 * arbitrary value, where whitespace is part of it — that is where a value like
 * `grid-cols-[repeat(auto-fit,minmax(0,1fr))]` lives.
 *
 * Quotes follow from that and are worth stating separately, because getting
 * them wrong is silent. A quote belongs to a candidate only *inside* an
 * arbitrary value (`content-['a b']`); anywhere else it ends one. Otherwise
 * `className={cn("p-4")}` — the paren opens a region, the quote does not close
 * it, and the extractor returns a single candidate running from `className`
 * to the closing brace with every class in the call swallowed inside it. That
 * is how `cn(...)` is written in every shadcn/ui component, so every one of
 * them was compiled against a stylesheet that had none of their classes in it.
 */
function extractCandidates(content: string, into: Set<string>) {
  let i = 0;

  while (i < content.length) {
    const start0 = content[i];
    if (/\s/.test(start0) || CANDIDATE_SKIP.has(start0)) {
      i++;
      continue;
    }

    const start = i;
    let depth = 0;

    while (i < content.length) {
      const c = content[i];

      if (c === "[") {
        depth++;
        i++;
        continue;
      }

      if (c === "]") {
        if (depth > 0) depth--;
        i++;
        continue;
      }

      if (c === "'" || c === '"' || c === "`") {
        if (depth === 0) break;

        // Inside an arbitrary value the quoted run is part of the candidate,
        // spaces and all.
        i++;
        while (i < content.length && content[i] !== c) i++;
        i++;
        continue;
      }

      if (/\s/.test(c)) {
        if (depth === 0) break;
        i++;
        continue;
      }

      i++;
    }

    const token = content.slice(start, i);
    if (token) into.add(token);
  }
}

/** Every class-like token in the project, minus the tokens Tailwind ignores. */
export function collectCandidates(files: CssSourceFile[]): string[] {
  const out = new Set<string>();
  for (const file of files) {
    if (file.path.endsWith(".css")) continue;
    extractCandidates(file.content, out);
  }
  out.delete("@vfs");
  return [...out];
}

const TAILWIND_ENTRY = "tailwindcss/index.css";

const NODE_MODULES = path.join(process.cwd(), "node_modules");

/** The animation utilities every shadcn/ui component animates with. */
const ANIMATIONS_IMPORT = '@import "tw-animate-css";';

type Stylesheet = { path: string; base: string; content: string };

/** The first of `candidates` that reads, with the usual spellings tried. */
async function readStylesheet(candidates: string[]): Promise<Stylesheet | null> {
  for (const candidate of candidates) {
    for (const attempt of [candidate, `${candidate}.css`, path.join(candidate, "index.css")]) {
      try {
        const content = await fs.readFile(/*turbopackIgnore: true*/ attempt, "utf8");
        return { path: attempt, base: path.dirname(attempt), content };
      } catch {
        // try the next spelling
      }
    }
  }

  return null;
}

/**
 * The `style` a package advertises for its root export.
 *
 * A package that ships CSS points at it with the `style` export condition —
 * `tw-animate-css` is exactly this, and so is the stylesheet half of most
 * design systems. Node's own resolver does not implement that condition, and
 * neither does Tailwind's importer, so it has to be read out of the manifest
 * by hand. The shapes below are the ones packages actually ship:
 *
 *   { ".": { "style": "./dist/x.css" } }
 *   { ".": { "style": { "default": "./dist/x.css" } } }
 *   { "style": "./dist/x.css" }
 *   "style" / "main" as plain fields
 */
function advertisedStylesheet(exportsField: unknown, manifest: Record<string, unknown>) {
  const fromExports = (value: unknown): string | null => {
    if (typeof value === "string") return value.endsWith(".css") ? value : null;
    if (!value || typeof value !== "object") return null;

    const record = value as Record<string, unknown>;
    for (const key of ["style", "sass", "default", "import", "require", "browser"]) {
      const found = fromExports(record[key]);
      if (found) return found;
    }
    return null;
  };

  const root =
    exportsField && typeof exportsField === "object" && "." in (exportsField as object)
      ? (exportsField as Record<string, unknown>)["."]
      : exportsField;

  const candidates = [
    fromExports(root),
    fromExports(exportsField),
    typeof manifest.style === "string" ? manifest.style : null,
    typeof manifest.main === "string" ? manifest.main : null,
  ];

  return candidates.find((value) => typeof value === "string" && value.endsWith(".css")) ?? null;
}

/**
 * A bare specifier that names an installed package's stylesheet.
 *
 *   "tw-animate-css"          -> node_modules/tw-animate-css/dist/tw-animate.css
 *   "tailwindcss/theme.css"   -> node_modules/tailwindcss/theme.css
 *   "@acme/theme/tokens.css"  -> node_modules/@acme/theme/tokens.css
 */
async function resolveInstalledStylesheet(id: string): Promise<Stylesheet | null> {
  const segments = id.split("/");
  const name = id.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
  const subpath = id.slice(name.length).replace(/^\//, "");
  const root = path.join(NODE_MODULES, name);

  if (subpath) return readStylesheet([path.join(root, subpath)]);

  let advertised: string | null = null;
  try {
    const manifest = JSON.parse(
      await fs.readFile(/*turbopackIgnore: true*/ path.join(root, "package.json"), "utf8")
    ) as Record<string, unknown>;
    advertised = advertisedStylesheet(manifest.exports, manifest);
  } catch {
    // No manifest, or one that does not parse: the plain file probes below
    // still cover the common layouts.
  }

  return readStylesheet([
    ...(advertised ? [path.join(root, advertised)] : []),
    path.join(root, "index.css"),
    path.join(root, "dist", "index.css"),
  ]);
}

/** Resolves Tailwind's own imports and any installed package stylesheet. */
async function loadStylesheet(id: string, base: string): Promise<Stylesheet> {
  const resolved =
    id.startsWith(".") || path.isAbsolute(id)
      ? await readStylesheet([path.resolve(base, id)])
      : id === "tailwindcss"
        ? await readStylesheet([path.join(NODE_MODULES, TAILWIND_ENTRY)])
        : await resolveInstalledStylesheet(id);

  if (resolved) return resolved;

  /**
   * A bare specifier the host does not have is not worth failing the build
   * over. `globals.css` is the one file authors paste wholesale, and the one
   * every shadcn project starting point announces itself in — so a project can
   * easily arrive importing a stylesheet this host has never heard of. An
   * empty sheet costs the author those rules and nothing else; throwing here
   * would cost them the entire preview.
   */
  if (!id.startsWith(".") && !path.isAbsolute(id)) {
    return { path: id, base: process.cwd(), content: "" };
  }

  throw new Error(`Cannot resolve stylesheet "${id}" from ${base}`);
}

/**
 * Compiles the project stylesheet. `styleCode` is the project's own
 * `globals.css`; the platform baseline is appended so every preview has the
 * same custom variants and utilities regardless of what the author trimmed.
 *
 * The animation utilities are folded into the baseline rather than left to the
 * project. They are not decoration for this platform — every shadcn/ui
 * component animates with them (`data-[state=open]:animate-in`,
 * `fade-in-0`, `slide-in-from-top-2`, `zoom-in-95`), so a stylesheet without
 * them renders a dialog, dropdown or tooltip that snaps into place with no
 * transition at all. A project that imports them itself keeps its own import;
 * one that does not gets them anyway.
 */
export async function compileProjectCss(
  files: CssSourceFile[],
  styleCode?: string
): Promise<string> {
  const trimmed = styleCode?.trim() ?? "";
  /**
   * Whether the project already imports Tailwind, by parsing the import rather
   * than by finding the word. A stylesheet whose comment reads
   * `/* generated by tailwindcss *​/` names Tailwind without importing it, and
   * the old substring test answered yes — so nothing was injected and every
   * utility silently disappeared from the preview.
   */
  const importsTailwind = /@import\s+(?:url\()?["']tailwindcss(?:["'/?])/.test(trimmed);
  const importsAnimations = /@import\s+["']tw-animate-css["']/.test(trimmed);

  /**
   * The platform palette goes in *before* the author's stylesheet.
   *
   * `PREVIEW_THEME_CSS` and a shadcn `globals.css` are both unlayered `:root`
   * and `.dark` rules with the same specificity, so the only thing that decides
   * between them is source order — and appending ours last meant the neutral
   * default overwrote whatever the author had themed. Invisible on the default
   * project, where the two are the same palette, and wrong the moment anyone
   * changed one token. Ours first makes it the floor the author paints over.
   */
  const source = [
    importsTailwind ? "" : `@import "tailwindcss";`,
    importsAnimations ? "" : ANIMATIONS_IMPORT,
    PREVIEW_THEME_CSS,
    trimmed,
  ]
    .filter((part) => part.trim().length > 0)
    .join("\n");

  const compiler = await compile(source, {
    base: process.cwd(),
    loadStylesheet,
    loadModule: async (id, base) => ({ path: id, base, module: {} as never }),
  });

  const candidates = collectCandidates(files);
  return compiler.build(candidates);
}

/**
 * Compiled stylesheets, keyed by the project they were built from.
 *
 * The studio compiles a project twice for every visit — once on the server,
 * so the sandbox boots with the right stylesheet, and again in the browser
 * whenever the author changes something. Identical projects are common (the
 * same draft reopened, a preview shared between surfaces), and a compile is
 * the most expensive thing in the editor's path, so the results are kept.
 */
const CSS_CACHE = new Map<string, CompiledPreview>();
const CSS_CACHE_LIMIT = 64;

export type CompiledPreview = {
  /** The project stylesheet, ready to inject as `/styles.css`. */
  css: string;
  /**
   * The vendored shadcn/ui sources the project reaches, keyed by project path.
   *
   * They are resolved here rather than in the browser on purpose: the whole
   * vendored registry is a couple of hundred kilobytes, and the sandbox only
   * needs the handful of files an import chain actually touches. Shipping the
   * registry to the client to work that out would dwarf the project itself.
   */
  vendored: PreviewFileInput[];
};

/**
 * Compiles a project's stylesheet, with the vendored shadcn/ui sources folded
 * in — the author only sends their own files — and reports which vendored
 * files the sandbox has to mount.
 */
export async function compileProjectCssCached(
  files: PreviewFileInput[],
  styleCode?: string
): Promise<CompiledPreview> {
  const key = JSON.stringify([styleCode ?? "", files]);
  const cached = CSS_CACHE.get(key);
  if (cached !== undefined) return cached;

  const authored = new Set(
    files.map((file) => (file.path.startsWith("/") ? file.path : `/${file.path}`))
  );
  const merged = withShadcnFiles(files);
  const vendored = merged.filter((file) => !authored.has(file.path));

  const css = await compileProjectCss(merged, styleCode);
  const result: CompiledPreview = { css, vendored };

  // Crude, but the working set is tiny and every entry is a few kilobytes.
  if (CSS_CACHE.size >= CSS_CACHE_LIMIT) CSS_CACHE.clear();
  CSS_CACHE.set(key, result);

  return result;
}
