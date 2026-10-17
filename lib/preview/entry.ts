/**
 * Where a project's preview starts.
 *
 * Both entry points used to guess, and both guessed the same wrong thing: the
 * sandbox rendered `/app/page.tsx` and nothing else, and the publish build fell
 * back to the alphabetically first `.tsx` in the project. That is fine for the
 * studio's own layout — a starter component at `/components/component.tsx` and
 * a demo at `/app/page.tsx` — and wrong for everything a shadcn block installs
 * as. `shadcn add dashboard-01` writes `app/dashboard/page.tsx` with a
 * `components/` folder beside it, so the alphabetical fallback picked
 * `components/app-sidebar.tsx`, a module with no default export, and the build
 * failed with "No matching export … for import default".
 *
 * So the order is: the page the caller asked for, the canonical `/app/page.tsx`,
 * any App Router page (shallowest route first, then alphabetically), a module
 * that *can* stand alone as an entry because it has a default export, and only
 * then any module at all.
 */

export type EntryFile = { path: string; content: string };

function normalize(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function depth(path: string): number {
  return path.split("/").length;
}

/** `export default` / `export default function` / `export { x as default }`. */
const DEFAULT_EXPORT_RE =
  /(?:^|\n)\s*export\s+default\b|(?:^|\n)\s*export\s*\{[^}]*\bas\s+default\b/;

export function hasDefaultExport(content: string): boolean {
  return DEFAULT_EXPORT_RE.test(content);
}

export function resolveEntryPage(
  files: EntryFile[],
  preferred?: string
): string | null {
  const byPath = new Map(files.map((file) => [normalize(file.path), file]));

  if (preferred && byPath.has(normalize(preferred))) return normalize(preferred);

  const canonical = "/app/page.tsx";
  if (byPath.has(canonical)) return canonical;

  const pages = [...byPath.values()]
    .filter((file) => /^\/app\/(?:.+\/)?page\.tsx?$/.test(file.path))
    .sort((a, b) => depth(a.path) - depth(b.path) || a.path.localeCompare(b.path));
  if (pages.length) return pages[0].path;

  const defaults = [...byPath.values()]
    .filter((file) => /\.tsx?$/.test(file.path) && hasDefaultExport(file.content))
    .sort((a, b) => a.path.localeCompare(b.path));
  if (defaults.length) return defaults[0].path;

  const anyModule = [...byPath.values()]
    .filter((file) => /\.tsx?$/.test(file.path))
    .sort((a, b) => a.path.localeCompare(b.path));

  return anyModule[0]?.path ?? null;
}
