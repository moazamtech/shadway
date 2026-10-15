import { SHADCN_FILES } from "./template/bundle";

export type PreviewFileInput = { path: string; content: string };

/**
 * The shadcn/ui folder every preview is handed.
 *
 * Authors write `import { Button } from "@/components/ui/button"` and the
 * import resolves, exactly as it would in a shadcn project — no pasting,
 * no docs. The sources are the vendored registry (see
 * `scripts/sync-shadcn-ui.ts`), and only the files an author actually
 * imports are added, transitively, so the per-preview compile stays small.
 */

const IMPORT_RE = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;
const EXTENSIONS = [".tsx", ".ts"];

/**
 * Where a vendored file is installed inside the preview's `/src` tree:
 *
 *   ui/button.tsx        -> /src/components/ui/button.tsx
 *   hooks/use-mobile.ts  -> /src/hooks/use-mobile.ts
 *   lib/utils.ts         -> /src/lib/utils.ts
 */
export function installedPathFor(vendored: string): string {
  if (vendored.startsWith("ui/")) return `/src/components/${vendored}`;
  return `/src/${vendored}`;
}

/**
 * Maps an import specifier to a vendored file:
 *
 *   @/components/ui/button          -> ui/button.tsx
 *   @/ui/button                     -> ui/button.tsx
 *   @/registry/new-york-v4/ui/dialog-> ui/dialog.tsx
 *   @/hooks/use-mobile              -> hooks/use-mobile.ts
 *   @/lib/utils                     -> lib/utils.ts
 */
export function vendoredPathFor(specifier: string): string | null {
  const clean = specifier
    .replace(/\.(tsx|ts|jsx|js)$/, "")
    .replace(/^@\/registry\/new-york-v4\//, "")
    .replace(/^@\//, "");

  const candidates = [clean, clean.replace(/^components\//, "")];
  for (const candidate of candidates) {
    for (const extension of EXTENSIONS) {
      const path = `${candidate}${extension}`;
      if (SHADCN_FILES[path]) return path;
    }
  }
  return null;
}

/**
 * Adds every vendored file the given file set imports, following the
 * imports inside those files too (dialog pulls in button, and so on).
 *
 * A file the author supplied themselves always wins — someone who ships
 * their own `components/ui/button.tsx` keeps it.
 */
export function withShadcnFiles<T extends PreviewFileInput>(files: T[]): PreviewFileInput[] {
  const normalized = files.map((file) => ({
    path: file.path.startsWith("/") ? file.path : `/${file.path}`,
    content: file.content,
  }));

  const present = new Set(normalized.map((file) => file.path));
  const added: PreviewFileInput[] = [];
  const pending: string[] = [];

  const collect = (content: string) => {
    for (const match of content.matchAll(IMPORT_RE)) {
      const specifier = match[1];
      if (!specifier.startsWith("@/")) continue;

      const vendored = vendoredPathFor(specifier);
      if (!vendored || !SHADCN_FILES[vendored]) continue;

      const path = installedPathFor(vendored);
      if (present.has(path)) continue;

      const source = SHADCN_FILES[vendored];
      present.add(path);
      added.push({ path, content: source });
      pending.push(source);
    }
  };

  normalized.forEach((file) => collect(file.content));
  while (pending.length) collect(pending.shift() as string);

  return [...normalized, ...added];
}

export function hasShadcnFile(aliasPath: string): boolean {
  return Boolean(SHADCN_FILES[aliasPath]);
}
