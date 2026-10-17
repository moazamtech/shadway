import { relativeImport, resolveProjectImport } from "@/lib/studio/sandpack";
import {
  DEFAULT_COMPONENT_PATH,
  DEFAULT_DEMO_PATH,
  DEFAULT_STYLE_PATH,
} from "@/lib/studio/starter";

/**
 * The project as the studio, the publish payload and the stored record all
 * agree on.
 *
 * The author's layout is theirs to choose: the component may live at
 * `components/hero-section.tsx` and the demo may import it by that name. So the
 * component's path is *resolved* from the project rather than assumed, and it
 * travels with the payload — rebuilding it at a fixed path would leave the demo
 * importing a file that no longer exists.
 */

/** Every `from "…"` / `import("…")` specifier in a file. */
const SPECIFIER_RE =
  /(\bimport\s+(?:[\s\S]*?\sfrom\s*)?|\bexport\s+(?:[\s\S]*?\sfrom\s*)|\bimport\s*\(\s*)(["'])([^"']+)\2/g;

/** `/components/hero-section.tsx` -> `@/components/hero-section` */
export function importSpecifier(path: string): string {
  return `@/${path.replace(/^\/+/, "").replace(/\.(tsx?|jsx?)$/, "")}`;
}

/** The author's own component files — everything but the vendored shadcn/ui. */
function isOwnComponent(path: string) {
  return path.startsWith("/components/") && !path.startsWith("/components/ui/");
}

/**
 * The file that gets published as the component.
 *
 * The demo page decides: whatever `app/page.tsx` renders is the component the
 * author is publishing. Falling back to the author's only file under
 * `components/`, and finally to the starter path, keeps a project publishable
 * even before its demo is written.
 */
export function resolveComponentPath(
  files: Record<string, string>,
  demoPath: string = DEFAULT_DEMO_PATH
): string {
  const known = new Set(Object.keys(files));
  const demo = files[demoPath] ?? "";

  for (const match of demo.matchAll(SPECIFIER_RE)) {
    const resolved = resolveProjectImport(match[3], demoPath, known);
    if (resolved && isOwnComponent(resolved) && files[resolved] !== undefined) {
      return resolved;
    }
  }

  const own = Object.keys(files).filter(isOwnComponent).sort();
  if (own.length === 1) return own[0];

  return DEFAULT_COMPONENT_PATH;
}

/**
 * Rewrites every import that points at `from` so it points at `to`.
 *
 * A rename has to carry its importers with it. Without this the demo keeps
 * importing the old name, the preview goes blank, and the studio looks broken
 * when the import is simply stale. Both styles are preserved: an `@/…` import
 * stays an alias, a relative one is recomputed.
 */
export function retargetImports(
  files: Record<string, string>,
  from: string,
  to: string
): Record<string, string> {
  const known = new Set(Object.keys(files));
  const next: Record<string, string> = {};

  for (const [path, content] of Object.entries(files)) {
    next[path] = content.replace(
      SPECIFIER_RE,
      (match, prefix: string, quote: string, specifier: string) => {
        const resolved = resolveProjectImport(specifier.trim(), path, known);
        if (resolved !== from) return match;

        const replacement = specifier.trim().startsWith("@/")
          ? importSpecifier(to)
          : relativeImport(path, to);
        return `${prefix}${quote}${replacement}${quote}`;
      }
    );
  }

  return next;
}

/** How a project file is classified in the published registry item. */
export function fileTypeFor(path: string) {
  if (path.startsWith("/components/ui/")) return "registry:ui";
  if (path.startsWith("/hooks/")) return "registry:hook";
  if (path.startsWith("/lib/")) return "registry:lib";
  if (path.startsWith("/components/")) return "registry:component";
  return "registry:file";
}

export type ProjectPayload = {
  title: string;
  /** Where the author keeps the component — stored so it can be written back. */
  componentPath: string;
  code: string;
  demoCode: string;
  styleCode: string;
  files: { path: string; content: string; type: string }[];
  dependencies: string[];
};

/** The shape every save path (auto, manual, Ctrl+S, publish) sends. */
export function projectPayload(
  files: Record<string, string>,
  title: string,
  dependencies: string[] = []
): ProjectPayload {
  const componentPath = resolveComponentPath(files);

  const extraFiles = Object.entries(files)
    .filter(
      ([path]) =>
        path !== componentPath &&
        path !== DEFAULT_DEMO_PATH &&
        path !== DEFAULT_STYLE_PATH
    )
    .map(([path, content]) => ({
      path: path.replace(/^\//, ""),
      content,
      type: fileTypeFor(path),
    }));

  return {
    title,
    componentPath,
    code: files[componentPath] ?? "",
    demoCode: files[DEFAULT_DEMO_PATH] ?? "",
    styleCode: files[DEFAULT_STYLE_PATH] ?? "",
    files: extraFiles,
    dependencies,
  };
}
