import { importSpecifier } from "@/lib/studio/project";
import {
  DEFAULT_COMPONENT_PATH,
  DEFAULT_DEMO_PATH,
  DEFAULT_STYLE_PATH,
  storedProjectPath,
} from "@/lib/studio/starter";

export type PreviewFileInput = { path: string; content: string };
export type PreviewFiles = Record<string, string>;

/** The page a preview boots from: the author's component, rendered. */
function demoSourceFor(componentPath: string): string {
  return `import Component from "${importSpecifier(componentPath)}";\nexport default function Page() {\n  return <Component />;\n}\n`;
}

/**
 * Accepts either a single component string (published component) or a full
 * file map (studio project) and returns a complete, previewable file set.
 *
 * The project is laid out like this site: the component in `components/` and
 * a page in `app/` that renders it, with `@/` resolving from the project root.
 * `componentPath` is where the component is written back — the author may have
 * renamed it, and the demo imports it by that name.
 *
 * The shadcn `components/ui` folder is not listed here: every preview is
 * handed the vendored registry files it imports (`withShadcnFiles`), the same
 * way a shadcn project resolves `@/components/ui/*` from disk.
 */
export function buildPreviewFiles(
  input: string | PreviewFiles,
  componentPath: string = DEFAULT_COMPONENT_PATH
): PreviewFileInput[] {
  if (typeof input !== "string") {
    return Object.entries(input).map(([path, content]) => ({
      path: path.startsWith("/") ? path : `/${path}`,
      content,
    }));
  }

  return [
    { path: componentPath, content: input },
    { path: DEFAULT_DEMO_PATH, content: demoSourceFor(componentPath) },
  ];
}

/**
 * Builds the complete previewable file set for a stored component.
 * Always guarantees a runnable `app/page.tsx` entry, uses the author's demo
 * when present, and appends any lib/hook support files.
 */
export function componentSourceFiles(component: {
  code: string;
  componentPath?: string;
  demoCode?: string;
  styleCode?: string;
  files?: { path: string; content: string }[];
}): PreviewFileInput[] {
  const componentPath = component.componentPath || DEFAULT_COMPONENT_PATH;
  const base = buildPreviewFiles(component.code, componentPath);

  if (component.demoCode?.trim()) {
    const demo: PreviewFileInput = {
      path: DEFAULT_DEMO_PATH,
      content: component.demoCode,
    };
    const existing = base.findIndex((file) => file.path === DEFAULT_DEMO_PATH);
    if (existing >= 0) base[existing] = demo;
    else base.push(demo);
  }

  for (const support of component.files ?? []) {
    if (!support?.content) continue;
    const path = storedProjectPath(support.path);
    if (base.some((file) => file.path === path)) continue;
    base.push({ path, content: support.content });
  }

  // The project stylesheet, when the author has one of their own.
  if (
    component.styleCode?.trim() &&
    !base.some((file) => file.path === DEFAULT_STYLE_PATH)
  ) {
    base.push({ path: DEFAULT_STYLE_PATH, content: component.styleCode });
  }

  if (!base.some((file) => file.path === DEFAULT_DEMO_PATH)) {
    base.push({ path: DEFAULT_DEMO_PATH, content: demoSourceFor(componentPath) });
  }

  return base;
}
