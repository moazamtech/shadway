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

const CANDIDATE_SKIP = new Set(["{", "}", "(", ")", "[", "]", ",", ";", ":", "=", "+", "|"]);

/**
 * Tailwind's own extractor, reproduced: a candidate is a run of non-whitespace
 * text, but quoted strings and balanced `[]`/`()` may hold spaces (arbitrary
 * values like `grid-cols-[repeat(auto-fit,minmax(0,1fr))]`).
 */
function extractCandidates(content: string, into: Set<string>) {
  const isBreak = (c: string) =>
    c === '"' || c === "'" || c === "<" || c === ">" || c === "`" || /\s/.test(c);

  let i = 0;
  while (i < content.length) {
    if (isBreak(content[i]) || CANDIDATE_SKIP.has(content[i])) {
      i++;
      continue;
    }

    const start = i;
    let depth = 0;

    while (i < content.length) {
      const c = content[i];
      if (c === "[" || c === "(") depth++;
      else if (c === "]" || c === ")") {
        depth--;
        if (depth < 0) break;
      } else if (depth === 0 && isBreak(c)) break;
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

/** Resolves Tailwind's own imports (`tailwindcss`, `./theme.css`) from disk. */
async function loadStylesheet(
  id: string,
  base: string
): Promise<{ path: string; base: string; content: string }> {
  const candidates: string[] = [];

  if (id === "tailwindcss") {
    candidates.push(path.join(process.cwd(), "node_modules", TAILWIND_ENTRY));
  } else if (id.startsWith(".") || path.isAbsolute(id)) {
    candidates.push(path.resolve(base, id));
  }

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

  throw new Error(`Cannot resolve stylesheet "${id}" from ${base}`);
}

/**
 * Compiles the project stylesheet. `styleCode` is the project's own
 * `globals.css`; the platform baseline is appended so every preview has the
 * same custom variants and utilities regardless of what the author trimmed.
 */
export async function compileProjectCss(
  files: CssSourceFile[],
  styleCode?: string
): Promise<string> {
  const trimmed = styleCode?.trim() ?? "";
  const source = trimmed.includes("tailwindcss")
    ? `${trimmed}\n${PREVIEW_THEME_CSS}`
    : `@import "tailwindcss";\n${trimmed}\n${PREVIEW_THEME_CSS}`;

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
