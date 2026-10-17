/**
 * Dependency helpers for the studio.
 *
 * The sandbox bundles in the browser, so the only thing the editor needs from
 * this module is which npm packages a project imports — Sandpack installs
 * exactly those.
 */

// Catches:
//   import { x } from "pkg"            (named, default, namespace)
//   import "pkg"                      (side-effect)
//   import("pkg") / await import("pkg") (dynamic)
//   require("pkg")                    (CommonJS)
//   export { x } from "pkg"            (re-export)
//   export * from "pkg"
// Template-literal dynamic imports are not matched; they are rare in component
// code and cannot be statically resolved anyway.
const IMPORT_RE =
  /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)(["'`])([^"'`]+)\1/g;

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

  const clean = specifier.trim().split("?")[0];
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
      const name = packageNameForSpecifier(match[2]);
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
 *
 * Every entry here is a package that `latest` would resolve to a *different
 * major* than the sources were written for. Check `npm view <pkg> version`
 * before adding one; if `latest` and the range agree, the entry is dead weight
 * and the fallback is a better answer.
 *
 * | package                | pinned      | `latest`   |
 * | ---------------------- | ----------- | ---------- |
 * | lucide-react           | ^0.544.0    | 1.x        |
 * | recharts               | ^2.15.4     | 3.x        |
 * | react-resizable-panels | ^3.0.6      | 4.x        |
 * | react-day-picker       | ^9.11.1     | 10.x       |
 * | motion                 | ^12.23.24   | 14.x       |
 * | framer-motion          | ^12.23.16   | 14.x       |
 */
export const SANDBOX_PACKAGE_VERSIONS: Record<string, string> = {
  // -- the shadcn/ui runtime: what the vendored registry itself imports ------
  // `@base-ui/react` and `@shadcn/react` are reached by the vendored
  // `combobox` and `message-scroller`, and by no file of the author's — so
  // without an entry here they were the two packages nobody ever pinned.
  "@base-ui/react": "^1.9.0",
  "@shadcn/react": "^0.3.1",
  "class-variance-authority": "^0.7.1",
  clsx: "^2.1.1",
  cmdk: "^1.1.1",
  "date-fns": "^4.1.0",
  "@date-fns/tz": "^1.2.0",
  "embla-carousel-react": "^8.6.0",
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

  // -- motion ---------------------------------------------------------------
  motion: "^12.23.24",
  "framer-motion": "^12.23.16",
  "tw-animate-css": "^1.4.0",
  "tailwindcss-animate": "^1.0.7",
  "@number-flow/react": "^0.6.2",
  "embla-carousel-autoplay": "^8.6.0",

  // -- theming, forms and the small utilities blocks reach for ---------------
  "next-themes": "^0.4.6",
  "@hookform/resolvers": "^5.2.2",
  zod: "^3.25.76",
  nanoid: "^5.1.6",

  // -- icons -----------------------------------------------------------------
  "react-icons": "^5.7.0",
  "@icons-pack/react-simple-icons": "^13.8.0",
  "@tabler/icons-react": "^3.49.0",

  // -- canvas, scroll and timeline ------------------------------------------
  gsap: "^3.14.2",
  "@gsap/react": "^2.1.2",
  lenis: "^1.3.11",
  ogl: "^0.0.11",

  // -- the individual Radix packages ----------------------------------------
  // The newer shadcn sources import the unified `radix-ui`, but anything
  // pasted from an older project imports one package per primitive. Each of
  // these tracks the version this site itself installs.
  "@radix-ui/react-accordion": "^1.2.12",
  "@radix-ui/react-alert-dialog": "^1.1.15",
  "@radix-ui/react-aspect-ratio": "^1.1.7",
  "@radix-ui/react-avatar": "^1.1.11",
  "@radix-ui/react-checkbox": "^1.3.3",
  "@radix-ui/react-collapsible": "^1.1.12",
  "@radix-ui/react-context-menu": "^2.2.16",
  "@radix-ui/react-dialog": "^1.1.15",
  "@radix-ui/react-dropdown-menu": "^2.1.16",
  "@radix-ui/react-hover-card": "^1.1.15",
  "@radix-ui/react-label": "^2.1.7",
  "@radix-ui/react-menubar": "^1.1.16",
  "@radix-ui/react-navigation-menu": "^1.2.14",
  "@radix-ui/react-popover": "^1.1.15",
  "@radix-ui/react-progress": "^1.1.7",
  "@radix-ui/react-radio-group": "^1.3.8",
  "@radix-ui/react-scroll-area": "^1.2.10",
  "@radix-ui/react-select": "^2.2.6",
  "@radix-ui/react-separator": "^1.1.7",
  "@radix-ui/react-slider": "^1.3.6",
  "@radix-ui/react-slot": "^1.2.3",
  "@radix-ui/react-switch": "^1.2.6",
  "@radix-ui/react-tabs": "^1.1.13",
  "@radix-ui/react-toggle": "^1.1.10",
  "@radix-ui/react-toggle-group": "^1.1.11",
  "@radix-ui/react-tooltip": "^1.2.8",
  "@radix-ui/react-use-controllable-state": "^1.2.2",
};

/** The version specifier the sandbox should install for `name`. */
export function sandboxPackageVersion(name: string): string {
  return SANDBOX_PACKAGE_VERSIONS[name] ?? "latest";
}
