import type { WithId } from "mongodb";
import { getComponentsCollection, type ComponentDocument } from "@/lib/db/components";
import { extractCssVars, mergeCssVars, type CssVars } from "@/lib/registry/parsers";

/**
 * Registry dependency resolution.
 *
 * Given a component's `registryDependencies` (each `author/slug`), walk the
 * tree, gather every file, merge npm dependencies and CSS variables, and hand
 * back something the shadcn CLI can install in one shot.
 *
 * Without this, a component that declares a registry dependency on another
 * shadway component would fail to install — the CLI would look for
 * `/r/<author>/<slug>` and find nothing, because shadway never resolved it.
 */

export type FullSlug = {
  author: string;
  slug: string;
};

/**
 * `registryDependencies` entries arrive either as `author/slug` or as a bare
 * shadway slug. Anything else is skipped with a note rather than aborting the
 * whole install.
 */
export function parseFullSlug(value: string): FullSlug | null {
  const slug = value.trim().replace(/^\/+|\/+$/g, "");
  if (!slug) return null;

  const parts = slug.split("/").filter(Boolean);
  if (parts.length === 2) {
    return { author: parts[0], slug: parts[1] };
  }
  if (parts.length === 1) {
    return { author: "", slug: parts[0] };
  }
  return null;
}

export type ResolvedFile = {
  path: string;
  content: string;
  type: string;
};

export type ResolvedComponent = {
  fullSlug: string;
  slug: string;
  author: string;
  code: string;
  registry: string;
  npmDependencies: Record<string, string>;
  files: ResolvedFile[];
  cssVars: CssVars;
};

export type ResolutionResult = {
  /** Every file in the tree, keyed by install path, in dependency order. */
  files: Record<string, ResolvedFile>;
  npmDependencies: Record<string, string>;
  cssVars: CssVars;
  /** Human-readable problems worth surfacing in logs, never fatal. */
  warnings: string[];
};

const MAX_DEPTH = 10;

/**
 * Resolves a component and everything it depends on, depth-first.
 *
 * Cycle-safe via `visited`, and bounded by `maxDepth`. Missing
 * components are skipped with a warning so one broken dependency cannot take
 * down an entire install.
 */
export async function resolveRegistryDependencies(
  rootSlugs: string[],
  options: { maxDepth?: number; currentDepth?: number; visited?: Set<string> } = {}
): Promise<ResolutionResult> {
  const {
    maxDepth = MAX_DEPTH,
    currentDepth = 0,
    visited = new Set<string>(),
  } = options;

  const files: Record<string, ResolvedFile> = {};
  const npmDependencies: Record<string, string> = {};
  const cssVars: CssVars = { light: {}, dark: {} };
  const warnings: string[] = [];

  for (const raw of rootSlugs) {
    const parsed = parseFullSlug(raw);
    if (!parsed) {
      warnings.push(`Skipping malformed registry dependency: ${raw}`);
      continue;
    }

    const key = parsed.author ? `${parsed.author}/${parsed.slug}` : parsed.slug;

    if (visited.has(key)) continue;
    if (currentDepth >= maxDepth) {
      warnings.push(`Maximum dependency depth reached for: ${key}`);
      continue;
    }

    visited.add(key);

    const component = await loadComponent(parsed);
    if (!component) {
      warnings.push(`Registry dependency not found: ${key}`);
      continue;
    }

    const resolved = toResolvedComponent(component, parsed);

    // Breadth-first ordering: a dependency's own files land before the parent
    // that pulls them in, which keeps override semantics predictable.
    for (const file of resolved.files) {
      if (!files[file.path]) files[file.path] = file;
    }
    Object.assign(npmDependencies, resolved.npmDependencies);
    const merged = mergeCssVars([cssVars, resolved.cssVars]);
    cssVars.light = merged.light;
    cssVars.dark = merged.dark;

    if (resolved.registryDependencies.length) {
      const nested = await resolveRegistryDependencies(resolved.registryDependencies, {
        maxDepth,
        currentDepth: currentDepth + 1,
        visited: new Set(visited),
      });

      for (const [path, file] of Object.entries(nested.files)) {
        if (!files[path]) files[path] = file;
      }
      Object.assign(npmDependencies, nested.npmDependencies);
      const nestedMerge = mergeCssVars([cssVars, nested.cssVars]);
      cssVars.light = nestedMerge.light;
      cssVars.dark = nestedMerge.dark;
      warnings.push(...nested.warnings);
    }
  }

  return { files, npmDependencies, cssVars, warnings };
}

type LoadedComponent = WithId<ComponentDocument>;

/**
 * `author/slug` needs both fields; a bare slug only needs one. Trying the
 * per-author form first keeps two components with the same slug in different
 * accounts addressable independently.
 */
async function loadComponent(parsed: FullSlug): Promise<LoadedComponent | null> {
  const collection = await getComponentsCollection();

  if (parsed.author) {
    const byAuthor = await collection.findOne({
      slug: parsed.slug,
      "author.username": parsed.author,
      status: "published",
      visibility: "public",
    });
    if (byAuthor) return byAuthor;

    // Fall back to a global slug match, so `registryDependencies` that only
    // carry a slug still resolve.
    return collection.findOne({
      slug: parsed.slug,
      status: "published",
      visibility: "public",
    });
  }

  return collection.findOne({
    slug: parsed.slug,
    status: "published",
    visibility: "public",
  });
}

function toResolvedComponent(
  component: LoadedComponent,
  parsed: FullSlug
): ResolvedComponent & { registryDependencies: string[] } {
  const files: ResolvedFile[] = [];

  // The component's own source. shadway components carry `code` inline plus
  // optional support files.
  files.push({
    path: `components/ui/${component.slug}.tsx`,
    content: component.code,
    type: "registry:component",
  });

  for (const support of component.files ?? []) {
    if (!support?.content) continue;
    const path = support.path.startsWith("/")
      ? support.path.replace(/^\/+/, "")
      : support.path;
    files.push({ path, content: support.content, type: support.type });
  }

  const cssVars: CssVars = { light: {}, dark: {} };
  for (const file of component.files ?? []) {
    if (file.path.endsWith(".css")) {
      const extracted = extractCssVars(file.content);
      cssVars.light = { ...cssVars.light, ...extracted.light };
      cssVars.dark = { ...cssVars.dark, ...extracted.dark };
    }
  }
  // `cssVars` on the document is already the parsed shape; prefer it when the
  // component never shipped a CSS file.
  if (!Object.keys(cssVars.light).length && !Object.keys(cssVars.dark).length) {
    if (component.cssVars && typeof component.cssVars === "object") {
      const stored = component.cssVars as Record<string, Record<string, string>>;
      for (const [theme, vars] of Object.entries(stored)) {
        if (theme === "light" || theme === "dark") {
          cssVars[theme] = { ...cssVars[theme], ...(vars ?? {}) };
        }
      }
    }
  }

  return {
    fullSlug: parsed.author ? `${parsed.author}/${component.slug}` : component.slug,
    slug: component.slug,
    author: component.author.username,
    code: component.code,
    registry: component.category || "ui",
    npmDependencies: indexByName(component.dependencies ?? []),
    files,
    cssVars,
    registryDependencies: component.registryDependencies ?? [],
  };
}

/**
 * `dependencies` is stored as an array of package names; shadcn expects a
 * `name -> version` map. Everything resolves to `latest` at this layer —
 * pinning happens when the component is published, not when it is installed.
 */
function indexByName(dependencies: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of dependencies) {
    if (typeof name === "string" && name.trim()) {
      const pkg = name.trim();
      if (pkg !== "react" && pkg !== "react-dom") result[pkg] = "latest";
    }
  }
  return result;
}
