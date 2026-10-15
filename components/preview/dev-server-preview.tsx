"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, TerminalSquare, TriangleAlert, X } from "lucide-react";

import { useDevServer, type DevServerProject } from "@/components/preview/use-dev-server";
import {
  prepareGeneratedFile,
  projectImportSpecifier,
} from "@/lib/preview/generated-code";
import { cn } from "@/lib/utils";

/**
 * The generated project, running on a real Next.js dev server.
 *
 * The iframe points straight at `next dev`, so the preview is the application
 * itself: real App Router, real imports, real hot reload. The console button in
 * the corner opens the server's own output — install progress, compile errors,
 * runtime errors — exactly as a terminal would show it.
 */

/** Files that mean nothing in an App Router project, or that the scaffold owns. */
const DROPPED = new Set([
  "/index.html",
  "/index.tsx",
  "/index.jsx",
  "/index.js",
  "/index.css",
  "/App.css",
  "/package.json",
  "/tsconfig.json",
  "/vite.config.ts",
  "/vite.config.js",
  "/vite.config.mjs",
]);

const TW_ANIMATE_CSS_URL =
  "https://cdn.jsdelivr.net/npm/tw-animate-css@1.4.0/dist/tw-animate.css";

type DevServerPreviewProps = {
  code?: string;
  files?: Record<string, string>;
  entryFile?: string;
  className?: string;
  showConsole?: boolean;
  title?: string;
  isDarkTheme?: boolean;
};

function normalize(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

/** Pulls the remote stylesheets out of the project CSS — they become <link>s. */
function splitStyleImports(css: string): { style: string; links: string[] } {
  const links: string[] = [];
  const withoutRemote = css.replace(
    /@import\s+url\(\s*["']?(https:\/\/[^"')]+)["']?\s*\)\s*;?/g,
    (_full, url: string) => {
      links.push(url);
      return "";
    }
  );
  if (/@import\s+["']tw-animate-css["']/.test(withoutRemote)) {
    links.push(TW_ANIMATE_CSS_URL);
  }
  const style = withoutRemote.replace(/@import\s+["'][^"']+["']\s*;?/g, "").trim();
  return { style, links };
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

function buildProject(options: {
  code?: string;
  files?: Record<string, string>;
  entryFile?: string;
}): DevServerProject | null {
  const files: Record<string, string> = {};
  let style = "";
  let links: string[] = [];

  for (const [rawPath, content] of Object.entries(options.files ?? {})) {
    if (typeof content !== "string") continue;
    const path = normalize(rawPath);

    if (path === "/index.css") {
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

  return {
    files,
    page: buildPage(projectImportSpecifier(entryPath), links),
    style,
    dependencies: [],
  };
}

function StatusDot({ status }: { status: string }) {
  const tone =
    status === "ready"
      ? "bg-emerald-500"
      : status === "error"
        ? "bg-red-500"
        : "bg-amber-500 animate-pulse";
  return <span className={cn("size-1.5 rounded-full", tone)} />;
}

function BootScreen({
  status,
  logs,
  detail,
}: {
  status: string;
  logs: string[];
  detail: string | null;
}) {
  const tail = logs.slice(-14);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-zinc-950 px-6 py-10 text-zinc-300">
      <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-zinc-400">
        {status === "error" ? (
          <TriangleAlert className="size-3.5 text-red-400" />
        ) : (
          <Loader2 className="size-3.5 animate-spin" />
        )}
        {status === "error"
          ? "The dev server stopped"
          : status === "installing"
            ? "Installing dependencies"
            : "Starting the Next.js dev server"}
      </div>

      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-white/10 bg-black/60">
        <pre className="max-h-56 overflow-auto px-3 py-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-400">
          {tail.length ? tail.join("\n") : "Waiting for output…"}
        </pre>
      </div>

      {detail ? (
        <p className="max-w-lg text-center font-mono text-[11px] text-red-400">{detail}</p>
      ) : null}
    </div>
  );
}

function ConsolePanel({
  logs,
  status,
  onClose,
  isDarkTheme,
}: {
  logs: string[];
  status: string;
  onClose: () => void;
  isDarkTheme: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-30 flex max-h-[55%] flex-col border-t",
        isDarkTheme ? "border-white/10 bg-zinc-950/95" : "border-black/10 bg-white/95"
      )}
    >
      <div
        className={cn(
          "flex flex-none items-center gap-2 border-b px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em]",
          isDarkTheme ? "border-white/10 text-white/70" : "border-black/10 text-black/70"
        )}
      >
        <TerminalSquare className="size-3.5" />
        <span>Console</span>
        <span
          className={cn(
            "ml-1 flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 tracking-normal",
            isDarkTheme ? "border-white/10 text-white/50" : "border-black/10 text-black/50"
          )}
        >
          <StatusDot status={status} />
          {status}
        </span>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "ml-auto rounded-sm p-1 transition-colors",
            isDarkTheme ? "hover:bg-white/10" : "hover:bg-black/5"
          )}
          aria-label="Close console"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <pre
        className={cn(
          "min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap",
          isDarkTheme ? "text-zinc-400" : "text-zinc-600"
        )}
      >
        {logs.length ? logs.slice(-200).join("\n") : "No output yet."}
      </pre>
    </div>
  );
}

export function DevServerPreview({
  code,
  files,
  entryFile,
  className,
  showConsole = false,
  isDarkTheme = true,
}: DevServerPreviewProps) {
  const project = useMemo(
    () => buildProject({ code, files, entryFile }),
    [code, files, entryFile]
  );
  const [sessionId] = useState(
    () => `gen-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
  );
  const [consoleOpen, setConsoleOpen] = useState(false);

  const { status, url, logs, detail } = useDevServer({
    enabled: Boolean(project),
    sessionId,
    project,
  });

  const ready = status === "ready" && Boolean(url);

  if (!project) {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center",
          isDarkTheme ? "bg-zinc-950 text-zinc-500" : "bg-background text-muted-foreground"
        )}
      >
        <TerminalSquare className="size-5" />
        <p className="text-xs">Describe a component and it will run here on a real Next.js dev server.</p>
      </div>
    );
  }

  return (
    <div className={cn("relative flex h-full w-full flex-col overflow-hidden", className)}>
      <div className="relative min-h-0 flex-1">
        {ready && url ? (
          <iframe
            key={url}
            src={`${url}?theme=${isDarkTheme ? "dark" : "light"}`}
            title="Component preview"
            className="h-full w-full border-0 bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
          />
        ) : (
          <BootScreen status={status} logs={logs} detail={detail} />
        )}
      </div>

      {showConsole ? (
        <>
          {!consoleOpen ? (
            <button
              type="button"
              onClick={() => setConsoleOpen(true)}
              className={cn(
                "absolute right-3 bottom-3 z-20 flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] uppercase shadow-sm backdrop-blur transition-colors",
                isDarkTheme
                  ? "border-white/15 bg-zinc-900/80 text-white/70 hover:text-white"
                  : "border-black/10 bg-white/85 text-black/60 hover:text-black"
              )}
            >
              <StatusDot status={status} />
              Console
            </button>
          ) : null}

          {consoleOpen ? (
            <ConsolePanel
              logs={logs}
              status={status}
              isDarkTheme={isDarkTheme}
              onClose={() => setConsoleOpen(false)}
            />
          ) : null}
        </>
      ) : null}

      {ready ? (
        <div className="pointer-events-none absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full border border-white/10 bg-zinc-900/70 px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] text-white/60 uppercase backdrop-blur">
          <Check className="size-3 text-emerald-400" />
          dev server
        </div>
      ) : null}
    </div>
  );
}
