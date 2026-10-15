/**
 * Dependency helpers shared by the sandbox seed (server) and the studio's
 * dev-server watcher (browser).
 */

const IMPORT_RE = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;
const IMPORT_FAILURE_RE = /Failed to resolve import "([^"]+)" from/;

/** Node's own modules never belong in package.json. */
const NODE_BUILTINS = new Set([
  "assert",
  "buffer",
  "child_process",
  "crypto",
  "events",
  "fs",
  "http",
  "https",
  "net",
  "os",
  "path",
  "process",
  "stream",
  "url",
  "util",
  "zlib",
]);

/**
 * The npm package behind an import specifier, or null for anything that is
 * not an installable package (relative paths, the `@/` alias, node builtins).
 *
 *   "react/jsx-runtime"      -> "react"
 *   "@radix-ui/react-dialog" -> "@radix-ui/react-dialog"
 *   "@/components/ui/button" -> null
 */
export function packageNameForSpecifier(specifier: string): string | null {
  if (!specifier) return null;
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;
  if (specifier.startsWith("@/")) return null;
  if (specifier.startsWith("node:")) return null;

  const clean = specifier.split("?")[0];
  const segments = clean.split("/");
  const name = clean.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
  if (!name || NODE_BUILTINS.has(name)) return null;
  return name;
}

/** Every npm package the given files import, sorted and deduped. */
export function collectNpmDependencies(files: { path: string; content: string }[]): string[] {
  const found = new Set<string>();
  for (const file of files) {
    for (const match of file.content.matchAll(IMPORT_RE)) {
      const name = packageNameForSpecifier(match[1]);
      if (name) found.add(name);
    }
  }
  return [...found].sort();
}

/** The specifier out of Vite's `Failed to resolve import "x" from ...` error. */
export function missingImportFromLog(message: string): string | null {
  return message.match(IMPORT_FAILURE_RE)?.[1] ?? null;
}

export type MissingDependencyInfo = { packageName: string; latestVersion: string };

/**
 * Resolves the npm package behind a dev-server import error against the
 * public registry, walking a nested path back to its package when needed
 * (`@/foo/bar` style 404s retry as `@/foo`). Returns null when the import
 * is not a resolvable package.
 */
export async function getLatestPackageVersionFromError(
  errorMessage: string
): Promise<MissingDependencyInfo | null> {
  let potentialPackageName = missingImportFromLog(errorMessage);

  if (
    !potentialPackageName ||
    potentialPackageName.startsWith(".") ||
    potentialPackageName.startsWith("/") ||
    potentialPackageName.startsWith("@/")
  ) {
    return null;
  }

  while (potentialPackageName) {
    try {
      const response = await fetch(`https://registry.npmjs.org/${potentialPackageName}`);
      if (response.ok) {
        const data = (await response.json()) as { "dist-tags"?: { latest?: string } };
        const latestVersion = data?.["dist-tags"]?.latest;
        return latestVersion ? { packageName: potentialPackageName, latestVersion } : null;
      }
      if (response.status !== 404) return null;

      // A deep import like "foo/dist/thing" may be missing while "foo"
      // resolves — retry one segment up before giving up.
      const lastSlashIndex = potentialPackageName.lastIndexOf("/");
      if (lastSlashIndex === -1) break;
      potentialPackageName = potentialPackageName.substring(0, lastSlashIndex);
    } catch {
      return null;
    }
  }

  return null;
}
