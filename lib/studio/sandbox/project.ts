import type { ComponentFile } from "@/lib/db/components";
import { withShadcnFiles } from "@/lib/preview/shadcn-ui";
import { PREVIEW_THEME_CSS } from "@/lib/preview/theme.generated";
import {
  DEFAULT_COMPONENT_CODE,
  DEFAULT_COMPONENT_PATH,
  DEFAULT_DEMO_CODE,
  DEFAULT_DEMO_PATH,
  DEFAULT_STYLE_CODE,
  DEFAULT_STYLE_PATH,
  storedProjectPath,
} from "@/lib/studio/starter";
import { collectNpmDependencies } from "./deps";

/**
 * The project a sandbox boots with.
 *
 * A real Next.js App Router project — `app/` for the page, `components/` for
 * the component, `@/*` resolving from the project root — so the dev server
 * the studio runs inside the VM is the same stack this site is built on. The
 * author's files and the vendored shadcn/ui sources are written on top, so
 * imports resolve on disk exactly the way the browser-side preview only
 * emulated.
 */

export type SandboxSeedFile = { path: string; content: string };

export type SandboxDraft = {
  code?: string;
  demoCode?: string;
  styleCode?: string;
  dependencies?: string[];
  files?: ComponentFile[];
};

/**
 * The stylesheet every sandbox starts with: Tailwind, then the shared shadcn
 * theme (tokens + animations), then whatever the author wrote. The dev server
 * compiles it for real — the same CSS the preview palette defines.
 */
export const SANDBOX_STYLE_PREFIX = `@import "tailwindcss";\n\n${PREVIEW_THEME_CSS}\n\n`;

const SANDBOX_NEXT_CONFIG = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The preview shows the component, not the dev server's own chrome.
  devIndicators: false,
  // Generated components reach for stock photography and avatars by URL.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "cdn.jsdelivr.net" },
    ],
  },
  // The preview is opened from the studio's own origin — this host for a local
  // dev server, CodeSandbox's proxy domain for a VM — so it has to accept
  // cross-origin requests coming from both.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "*.csb.app",
    "*.codesandbox.io",
    "*.csb.dev",
  ],
};

export default nextConfig;
`;

const SANDBOX_POSTCSS_CONFIG = `const config = {
  plugins: ["@tailwindcss/postcss"],
};

export default config;
`;

const SANDBOX_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": false,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`;

/**
 * The layout the preview page renders inside — the same shape as this site's
 * own root layout: it imports the project stylesheet and hands the page to the
 * root element.
 */
const SANDBOX_LAYOUT_TSX = `import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeSync } from "./theme-sync";

export const metadata: Metadata = {
  title: "Component preview",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
`;

/**
 * The studio renders this project in an iframe and forwards its theme, so the
 * preview always wears the same colors as the editor around it.
 */
const SANDBOX_THEME_SYNC_TSX = `"use client";

import { useEffect } from "react";

function applyTheme(theme: string) {
  const dark = theme === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeSync() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const params = new URLSearchParams(window.location.search);
    applyTheme(params.get("theme") || (media.matches ? "dark" : "light"));

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; theme?: string } | null;
      if (data?.type === "shadway:theme" && data.theme) applyTheme(data.theme);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}
`;

const BASE_DEPENDENCIES: Record<string, string> = {
  next: "^15.5.15",
  react: "^19.1.2",
  "react-dom": "^19.1.2",
};

const BASE_DEV_DEPENDENCIES: Record<string, string> = {
  "@tailwindcss/postcss": "^4",
  "@types/node": "^22",
  "@types/react": "^19",
  "@types/react-dom": "^19",
  tailwindcss: "^4",
  typescript: "^5",
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
      scripts: {
        dev: "next dev -p 3000",
        build: "next build",
        start: "next start -p 3000",
      },
      dependencies,
      devDependencies: BASE_DEV_DEPENDENCIES,
    },
    null,
    2
  )}\n`;
}

/** The draft's own files, as project paths (`/app/...`, `/components/...`). */
export function componentProjectFiles(component: SandboxDraft): Record<string, string> {
  const files: Record<string, string> = {};

  for (const file of component.files ?? []) {
    if (!file?.content) continue;
    files[storedProjectPath(file.path)] = file.content;
  }

  files[DEFAULT_COMPONENT_PATH] = component.code?.trim() ? component.code : DEFAULT_COMPONENT_CODE;
  files[DEFAULT_DEMO_PATH] = component.demoCode?.trim() ? component.demoCode : DEFAULT_DEMO_CODE;
  files[DEFAULT_STYLE_PATH] = component.styleCode?.trim()
    ? component.styleCode
    : DEFAULT_STYLE_CODE;

  return files;
}

/**
 * Everything a fresh sandbox needs on disk: the Next.js scaffold, the author's
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
    { path: "/next.config.ts", content: SANDBOX_NEXT_CONFIG },
    { path: "/postcss.config.mjs", content: SANDBOX_POSTCSS_CONFIG },
    { path: "/tsconfig.json", content: SANDBOX_TSCONFIG },
    { path: "/app/layout.tsx", content: SANDBOX_LAYOUT_TSX },
    { path: "/app/theme-sync.tsx", content: SANDBOX_THEME_SYNC_TSX },
  ];

  // The stylesheet goes out exactly as the client would write it — Tailwind
  // import and theme in front — so the project boots complete even before the
  // editor's first sync, and live edits keep the theme too.
  const rest = resolved.map((file) =>
    file.path === DEFAULT_STYLE_PATH
      ? {
          path: file.path,
          content: file.content.startsWith('@import "tailwindcss"')
            ? file.content
            : `${SANDBOX_STYLE_PREFIX}${file.content}`,
        }
      : file
  );

  return [...scaffold, ...rest];
}
