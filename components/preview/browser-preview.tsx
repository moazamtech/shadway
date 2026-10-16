"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { TerminalSquare } from "lucide-react";

import { collectNpmDependencies } from "@/lib/studio/deps";
import { usePreviewCss } from "@/lib/studio/use-preview-css";
import { splitStyleImports } from "@/lib/studio/sandpack";
import {
  prepareGeneratedFile,
  projectImportSpecifier,
} from "@/lib/preview/generated-code";
import { cn } from "@/lib/utils";

/**
 * Renders a generated project in the browser.
 *
 * Sandpack bundles and runs the code on the visitor's own machine — there is no
 * server, no dev server and nothing to scale. The published artifact is built
 * separately (see `lib/preview/build`); this is the editing surface.
 */

const SandpackPreviewPane = dynamic(
  () => import("@/components/studio/sandpack-preview").then((mod) => mod.SandpackPreviewPane),
  { ssr: false }
);

/** Files that mean nothing in an App Router project, or that the scaffold owns. */
const DROPPED = new Set([
  "/index.html",
  "/index.tsx",
  "/index.jsx",
  "/index.js",
  "/App.css",
  "/package.json",
  "/tsconfig.json",
  "/vite.config.ts",
  "/vite.config.js",
  "/vite.config.mjs",
]);

/** The page the sandbox renders: the generated component, at full size. */
const PREVIEW_PAGE = "/__preview.tsx";

export type BrowserPreviewProps = {
  code?: string;
  files?: Record<string, string>;
  entryFile?: string;
  className?: string;
  /** Kept for callers that asked for the old server console. */
  showConsole?: boolean;
  title?: string;
  isDarkTheme?: boolean;
};

function normalize(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function buildPage(importPath: string, links: string[]): string {
  const linkTags = links.length
    ? `${links.map((href) => `      <link rel="stylesheet" href="${href}" />`).join("\n")}\n`
    : "";

  return `import Entry from "${importPath}";

const defaultProps = {
  title: "Preview",
  subtitle: "",
  description: "",
  items: [],
  features: [],
  links: [],
  stats: [],
  count: 0,
  percentage: 0,
  className: "",
};

export default function Page() {
  return (
    <>
${linkTags}      <div className="min-h-screen w-full bg-background text-foreground">
        <Entry {...defaultProps} />
      </div>
    </>
  );
}
`;
}

type BuiltProject = {
  files: Record<string, string>;
  page: string;
  style: string;
  dependencies: string[];
};
function buildProject(options: {
  code?: string;
  files?: Record<string, string>;
  entryFile?: string;
}): BuiltProject | null {
  const files: Record<string, string> = {};
  let style = "";
  let links: string[] = [];

  for (const [rawPath, content] of Object.entries(options.files ?? {})) {
    if (typeof content !== "string") continue;
    const path = normalize(rawPath);

    if (path === "/index.css" || path === "/app/globals.css") {
      const split = splitStyleImports(content);
      style = split.style;
      links = split.links;
      continue;
    }

    if (DROPPED.has(path)) continue;
    files[path] = prepareGeneratedFile(content);
  }

  const requested = options.entryFile ? normalize(options.entryFile) : null;
  let entryPath: string | null = null;

  if (requested && files[requested]) entryPath = requested;
  if (!entryPath && files["/App.tsx"]) entryPath = "/App.tsx";
  if (!entryPath && files["/entry.tsx"]) entryPath = "/entry.tsx";
  if (!entryPath) {
    entryPath = Object.keys(files).find((path) => path.endsWith(".tsx")) ?? null;
  }

  if (!entryPath) {
    if (!options.code?.trim()) return null;
    entryPath = "/GeneratedEntry.tsx";
    files[entryPath] = prepareGeneratedFile(options.code);
  }

  files[PREVIEW_PAGE] = buildPage(projectImportSpecifier(entryPath), links);

  return {
    files,
    page: PREVIEW_PAGE,
    style,
    dependencies: collectNpmDependencies(
      Object.entries(files).map(([path, content]) => ({ path, content }))
    ),
  };
}

export function BrowserPreview({
  code,
  files,
  entryFile,
  className,
  isDarkTheme = true,
}: BrowserPreviewProps) {
  const project = useMemo(
    () => buildProject({ code, files, entryFile }),
    [code, files, entryFile]
  );

  const { css, vendored } = usePreviewCss(project?.files ?? {}, project?.style);

  if (!project) {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center",
          isDarkTheme ? "bg-zinc-950 text-zinc-500" : "bg-background text-muted-foreground"
        )}
      >
        <TerminalSquare className="size-5" />
        <p className="text-xs">Describe a component and it will run here.</p>
      </div>
    );
  }

  return (
    <div className={cn("relative flex h-full w-full flex-col overflow-hidden", className)}>
      <SandpackPreviewPane
        files={project.files}
        vendoredFiles={vendored}
        page={project.page}
        compiledCss={css ?? undefined}
        dependencies={project.dependencies}
        theme={isDarkTheme ? "dark" : "light"}
        className="h-full w-full"
      />
    </div>
  );
}
