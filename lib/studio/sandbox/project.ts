import type { ComponentFile } from "@/lib/db/components";
import { withShadcnFiles } from "@/lib/preview/shadcn-ui";
import { PREVIEW_THEME_CSS } from "@/lib/preview/theme.generated";
import {
  DEFAULT_COMPONENT_CODE,
  DEFAULT_COMPONENT_PATH,
  DEFAULT_DEMO_CODE,
  DEFAULT_DEMO_PATH,
  DEFAULT_STYLE_CODE,
} from "@/lib/studio/starter";
import { collectNpmDependencies } from "./deps";

/**
 * The project a sandbox boots with.
 *
 * A stock Vite + React + Tailwind v4 project whose `@/` alias points at
 * `src/` — the layout every shadcn project has. The author's files and the
 * vendored shadcn/ui sources are written on top, so imports resolve on disk
 * exactly the way the browser-side preview only emulated.
 */

export type SandboxSeedFile = { path: string; content: string };

export type SandboxDraft = {
  code?: string;
  demoCode?: string;
  dependencies?: string[];
  files?: ComponentFile[];
};

/**
 * The stylesheet every sandbox starts with: Tailwind, then the shared shadcn
 * theme (tokens + animations), then whatever the author wrote. The dev
 * server compiles it for real — the same CSS the preview palette defines.
 */
export const SANDBOX_INDEX_CSS_PREFIX = `@import "tailwindcss";\n\n${PREVIEW_THEME_CSS}\n\n`;

const SANDBOX_VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // "@/..." resolves to "src/..." — the alias every shadcn project uses.
    alias: {
      "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // The preview is opened through CodeSandbox's proxy domain.
    allowedHosts: true,
  },
});
`;

const SANDBOX_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": false,
    "skipLibCheck": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
`;

const SANDBOX_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Component preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const SANDBOX_MAIN_TSX = `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

/**
 * The studio renders this project in an iframe and forwards its theme, so
 * the preview always wears the same colors as the editor around it.
 */
function applyTheme(theme: string) {
  const dark = theme === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

const media = window.matchMedia("(prefers-color-scheme: dark)");
const params = new URLSearchParams(window.location.search);
applyTheme(params.get("theme") || (media.matches ? "dark" : "light"));

window.addEventListener("message", (event) => {
  const data = event.data as { type?: string; theme?: string } | null;
  if (data?.type === "shadway:theme" && data.theme) applyTheme(data.theme);
});

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
`;

const BASE_DEPENDENCIES: Record<string, string> = {
  react: "^18.3.1",
  "react-dom": "^18.3.1",
};

const BASE_DEV_DEPENDENCIES: Record<string, string> = {
  vite: "latest",
  "@vitejs/plugin-react": "latest",
  tailwindcss: "latest",
  "@tailwindcss/vite": "latest",
};

/** The generated package.json, with every imported package preinstalled. */
export function sandboxPackageJson(npmPackages: string[]): string {
  const dependencies: Record<string, string> = { ...BASE_DEPENDENCIES };
  for (const name of npmPackages) {
    if (!dependencies[name]) dependencies[name] = "latest";
  }

  return `${JSON.stringify(
    {
      name: "shadway-component",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
      },
      dependencies,
      devDependencies: BASE_DEV_DEPENDENCIES,
    },
    null,
    2
  )}\n`;
}

/** The draft's own files, as project paths (`/src/...`). */
export function componentProjectFiles(component: SandboxDraft): Record<string, string> {
  const files: Record<string, string> = {
    [DEFAULT_COMPONENT_PATH]: component.code?.trim() ? component.code : DEFAULT_COMPONENT_CODE,
    [DEFAULT_DEMO_PATH]: component.demoCode?.trim() ? component.demoCode : DEFAULT_DEMO_CODE,
    "/src/index.css": DEFAULT_STYLE_CODE,
  };

  for (const file of component.files ?? []) {
    const path = file.path.startsWith("/") ? file.path : `/${file.path}`;
    const projectPath = path.startsWith("/src/") ? path : `/src/${path}`;
    files[projectPath] = file.content;
  }

  return files;
}

/**
 * Everything a fresh sandbox needs on disk: the Vite scaffold, the author's
 * files, and the vendored shadcn/ui sources their imports resolve against.
 * Only used when a sandbox is created — resuming one keeps whatever it has.
 */
export function sandboxSeedFiles(component: SandboxDraft): SandboxSeedFile[] {
  const project = componentProjectFiles(component);
  const resolved = withShadcnFiles(
    Object.entries(project).map(([path, content]) => ({ path, content }))
  );

  const npmPackages = [
    ...collectNpmDependencies(resolved),
    ...(component.dependencies ?? []),
  ];

  const scaffold: SandboxSeedFile[] = [
    { path: "/package.json", content: sandboxPackageJson(npmPackages) },
    { path: "/vite.config.ts", content: SANDBOX_VITE_CONFIG },
    { path: "/tsconfig.json", content: SANDBOX_TSCONFIG },
    { path: "/index.html", content: SANDBOX_INDEX_HTML },
    { path: "/src/main.tsx", content: SANDBOX_MAIN_TSX },
  ];

  // index.css is sent as the author wrote it — the client prefixes the
  // Tailwind import + theme before writing it into the VM, so live edits
  // keep the theme too.
  const rest = resolved.filter((file) => file.path !== "/src/index.css");

  return [...scaffold, ...rest];
}
