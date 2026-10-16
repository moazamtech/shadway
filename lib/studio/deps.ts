/**
 * Dependency helpers for the studio.
 *
 * The sandbox bundles in the browser, so the only thing the editor needs from
 * this module is which npm packages a project imports — Sandpack installs
 * exactly those.
 */

const IMPORT_RE = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;

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

/**
 * The versions the sandbox installs for the packages the design system itself
 * is built on.
 *
 * Asking npm for `latest` is a trap here. The vendored shadcn/ui sources and
 * every block import these packages, so one new major breaks every component
 * in the studio at the same moment — and it has: `lucide-react` 1.0 dropped the
 * brand icons, so every footer reaching for `Github` or `Twitter` suddenly
 * rendered `undefined` and React reported "Element type is invalid".
 *
 * These mirror the ranges this site is built against (`package.json`), so a
 * component is compiled against the same code in the sandbox, in the
 * marketplace preview and in the published build. Anything the author asks for
 * that is not listed still resolves to the newest release.
 */
export const SANDBOX_PACKAGE_VERSIONS: Record<string, string> = {
  "class-variance-authority": "^0.7.1",
  clsx: "^2.1.1",
  cmdk: "^1.1.1",
  "embla-carousel-react": "^8.6.0",
  "framer-motion": "^12.23.16",
  "input-otp": "^1.4.2",
  "lucide-react": "^0.544.0",
  "radix-ui": "^1.8.1",
  "react-day-picker": "^9.11.1",
  "react-hook-form": "^7.65.0",
  "react-resizable-panels": "^3.0.6",
  recharts: "^2.15.4",
  sonner: "^2.0.7",
  "tailwind-merge": "^3.3.1",
  vaul: "^1.1.2",
};

/** The version specifier the sandbox should install for `name`. */
export function sandboxPackageVersion(name: string): string {
  return SANDBOX_PACKAGE_VERSIONS[name] ?? "latest";
}
