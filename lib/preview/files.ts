export type PreviewFileInput = { path: string; content: string };
export type PreviewFiles = Record<string, string>;

/**
 * Accepts either a single component string (published component) or a full
 * file map (studio project) and returns a complete, previewable file set.
 *
 * The shadcn `components/ui` folder is not listed here: every preview is
 * handed the vendored registry files it imports (`withShadcnFiles`), the same
 * way a shadcn project resolves `@/components/ui/*` from disk.
 */
export function buildPreviewFiles(input: string | PreviewFiles): PreviewFileInput[] {
  if (typeof input !== "string") {
    return Object.entries(input).map(([path, content]) => ({
      path: path.startsWith("/") ? path : `/${path}`,
      content,
    }));
  }

  return [
    { path: "/src/components/component.tsx", content: input },
    {
      path: "/src/App.tsx",
      content: `import Component from "./components/component";\nexport default function App() {\n  return <Component />;\n}\n`,
    },
  ];
}

/**
 * Builds the complete previewable file set for a stored component.
 * Always guarantees a runnable `/src/App.tsx` entry, uses the author's demo
 * when present, and appends any lib/hook support files.
 */
export function componentSourceFiles(component: {
  code: string;
  demoCode?: string;
  files?: { path: string; content: string }[];
}): PreviewFileInput[] {
  const base = buildPreviewFiles(component.code);

  if (component.demoCode?.trim()) {
    const demo: PreviewFileInput = {
      path: "/src/App.tsx",
      content: component.demoCode,
    };
    const existing = base.findIndex((file) => file.path === "/src/App.tsx");
    if (existing >= 0) base[existing] = demo;
    else base.push(demo);
  }

  for (const support of component.files ?? []) {
    if (!support?.content) continue;
    const path = support.path.startsWith("/") ? support.path : `/src/${support.path}`;
    if (base.some((file) => file.path === path)) continue;
    base.push({ path, content: support.content });
  }

  if (!base.some((file) => file.path === "/src/App.tsx")) {
    base.push({
      path: "/src/App.tsx",
      content: `import Component from "./components/component";\nexport default function App() {\n  return <Component />;\n}\n`,
    });
  }

  return base;
}