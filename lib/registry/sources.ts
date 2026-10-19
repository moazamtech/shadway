import { DEFAULT_COMPONENT_PATH } from "@/lib/studio/starter";

/**
 * The files a published component actually consists of.
 *
 * The studio stores the author's *whole project*, not the component: the
 * starter's `components/component.tsx` is still in the file map long after it
 * has been replaced, and the demo page and `globals.css` travel with it. None
 * of that is the component.
 *
 * Shipping the map verbatim caused two visible defects:
 *
 *   - `hero-section` installed a `components/component.tsx` reading "Shadway
 *     Starter" beside the real `hero.tsx` — a file the consumer never imports,
 *     which collides with any file they already have at that path;
 *   - the code tab listed the scaffold as one of the component's files, so
 *     "Copy" could hand somebody the starter instead of the thing they were
 *     looking at.
 *
 * The set is derived the way a bundler derives it: start at the component's
 * entry and follow relative and `@/` imports. Anything unreachable is the
 * author's scaffolding, not the component. Primitives under `components/ui/`
 * are not in the author's map and are deliberately not followed — they are
 * `registryDependencies`, fetched from shadcn's registry by the CLI.
 *
 * Pure and dependency-free on purpose: the server builds registry items from
 * it and the detail page's code viewer renders from it.
 */

export type SourceEntry = {
  /** Project-absolute, e.g. `/components/hero.tsx`. */
  path: string;
  content: string;
  /** The stored file type, when the record has one. */
  type?: unknown;
};

/** `from "…"`, `import("…")`, `require("…")`, `import "…"` — CSS `@import` excluded. */
const SPECIFIER_RE =
  /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|(?<!@)\bimport\s+)(["'])([^"']+)\1/g;

function canonical(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (!path) return null;
  if (path.includes("\0")) return null;
  // Windows drive paths and traversal are not part of any author's project.
  if (/^[a-zA-Z]:/.test(path)) return null;
  if (path.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    return null;
  }
  return `/${path}`;
}

/** POSIX join, without `node:path` — this module runs in a browser too. */
function join(from: string, relative: string): string {
  const segments = `${from.slice(0, from.lastIndexOf("/"))}/${relative}`.split("/");
  const out: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") out.pop();
    else out.push(segment);
  }
  return `/${out.join("/")}`;
}

const SUFFIXES = ["", ".tsx", ".ts", ".jsx", ".js", ".css", ".json"];

function resolve(from: string, specifier: string, known: Set<string>): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = `/${specifier.slice(2)}`;
  else if (specifier.startsWith("~/")) base = `/${specifier.slice(2)}`;
  else if (specifier.startsWith(".")) base = join(from, specifier);
  else return null;

  for (const suffix of SUFFIXES) {
    if (known.has(`${base}${suffix}`)) return `${base}${suffix}`;
  }
  for (const suffix of [".tsx", ".ts", ".jsx", ".js"]) {
    if (known.has(`${base}/index${suffix}`)) return `${base}/index${suffix}`;
  }
  return null;
}

function specifiersOf(source: string): string[] {
  return [...source.matchAll(SPECIFIER_RE)].map((match) => match[2]);
}

/**
 * The entry file first, then everything reachable from it, in the author's
 * order. An author's map with no entry and no code has no component in it, so
 * that case returns nothing rather than guessing.
 */
export function reachableSourceFiles(input: {
  code?: unknown;
  componentPath?: unknown;
  files?: { path?: unknown; content?: unknown; type?: unknown }[];
}): SourceEntry[] {
  const contents = new Map<string, string>();
  const types = new Map<string, unknown>();
  const order: string[] = [];

  for (const file of input.files ?? []) {
    const path = canonical(file?.path);
    if (!path || typeof file?.content !== "string" || !file.content.trim()) continue;
    if (contents.has(path)) continue;
    contents.set(path, file.content);
    if (file?.type !== undefined) types.set(path, file.type);
    order.push(path);
  }

  const entry = canonical(input.componentPath) ?? DEFAULT_COMPONENT_PATH;
  const code = typeof input.code === "string" ? input.code : "";
  if (code.trim()) {
    if (!contents.has(entry)) order.unshift(entry);
    contents.set(entry, code);
  }

  if (!contents.has(entry)) return [];

  const known = new Set(contents.keys());
  const seen = new Set([entry]);
  const queue = [entry];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const specifier of specifiersOf(contents.get(current) ?? "")) {
      const resolved = resolve(current, specifier, known);
      if (!resolved || seen.has(resolved)) continue;
      seen.add(resolved);
      queue.push(resolved);
    }
  }

  return [entry, ...order.filter((path) => path !== entry && seen.has(path))].map(
    (path) => ({
      path,
      content: contents.get(path)!,
      ...(types.has(path) ? { type: types.get(path) } : {}),
    })
  );
}

/**
 * Repoints an import that names a file whose installed path differs.
 *
 * Moving the set together keeps `./install-panel` valid, but two edges do not
 * survive the move: an `@/components/…` alias, because the directory changed,
 * and anything naming the entry, because the entry is renamed to the slug. Both
 * become `@/…` against the installed path — the alias `shadcn add` rewrites to
 * whatever the consumer configured, so it is the one form that is safe without
 * knowing their tsconfig.
 *
 * Everything else is left exactly as the author wrote it.
 */
export function retargetImports(input: {
  content: string;
  /** The author's path for this file. */
  from: string;
  /** Every path in the authored set, for resolving the specifier. */
  authorPaths: Set<string>;
  /** Author path → installed path, for the files that are being written. */
  installed: Map<string, string>;
  /** The author's entry path — the file that gets renamed. */
  entry: string;
}): string {
  return input.content.replace(SPECIFIER_RE, (full, quote, specifier) => {
    const isAlias = specifier.startsWith("@/") || specifier.startsWith("~/");
    const target = resolve(input.from, specifier, input.authorPaths);
    if (!target) return full;

    // A relative edge between two files that both keep their names still works.
    if (!isAlias && target !== input.entry) return full;

    const installed = input.installed.get(target);
    if (!installed) return full;

    const alias = `@/${installed
      .replace(/^\/+/, "")
      .replace(/\.(tsx?|jsx?)$/, "")}`;
    if (alias === specifier) return full;

    return full.replace(`${quote}${specifier}${quote}`, `${quote}${alias}${quote}`);
  });
}
