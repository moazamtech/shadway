import type { PreviewFiles } from "@/lib/preview/files";

/**
 * The files a new component project starts from.
 *
 * The layout is the one this site ships with: a Next.js App Router project —
 * `app/` for the demo page, `components/` for the component being written,
 * `lib/` and `hooks/` for whatever shadcn/ui brings along. Only the author's
 * own files live here; the shadcn/ui folder is resolved from the registry
 * (`@/components/ui/button`), exactly like an installed shadcn project, so the
 * tree stays focused on what the author writes.
 */
export const DEFAULT_COMPONENT_CODE = `export default function MyComponent() {
  return (
    <section className="w-full bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Shadway Starter
        </h1>

        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
          A small starting point for your component, styled with the shadcn/ui theme tokens — so
          it follows the palette in light and dark mode. Edit this file and the preview rebuilds
          as you type.
        </p>
      </div>
    </section>
  );
}
`;

export const DEFAULT_DEMO_CODE = `import MyComponent from "@/components/component";

export default function Page() {
  return (
    <main className="min-h-screen w-full bg-background text-foreground">
      <MyComponent />
    </main>
  );
}
`;

export const DEFAULT_STYLE_CODE = `@import "tailwindcss";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
`;

/** The component the author publishes. */
export const DEFAULT_COMPONENT_PATH = "/components/component.tsx";
/** The page that renders it — `app/page.tsx`, like any App Router project. */
export const DEFAULT_DEMO_PATH = "/app/page.tsx";
/** The project stylesheet, imported by the app layout. */
export const DEFAULT_STYLE_PATH = "/app/globals.css";

export const STARTER_FILES: PreviewFiles = {
  [DEFAULT_COMPONENT_PATH]: DEFAULT_COMPONENT_CODE,
  [DEFAULT_DEMO_PATH]: DEFAULT_DEMO_CODE,
  [DEFAULT_STYLE_PATH]: DEFAULT_STYLE_CODE,
};

/** Copy so two drafts never share the same object. */
export function starterFiles(): PreviewFiles {
  return { ...STARTER_FILES };
}

/**
 * A stored support file's path, brought into the project layout.
 *
 * Records written before the app-folder layout kept everything under `src/`;
 * those paths are read as the root-relative ones they always meant.
 */
export function storedProjectPath(path: string): string {
  const clean = path.replace(/^\/+/, "").replace(/^src\//, "");
  return `/${clean}`;
}
