"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BuildError,
  TranspiledModule,
  UnresolvedImport,
} from "@/lib/preview/transpile";
import { PREVIEW_ERROR_CSS, PREVIEW_ERROR_SCRIPT } from "@/lib/preview/error-overlay";
import { PREVIEW_THEME_CSS } from "@/lib/preview/theme.generated";

export type PreviewFileInput = { path: string; content: string };

type Props = {
  files: PreviewFileInput[];
  entry?: string;
  height?: number | string;
  className?: string;
  theme?: "light" | "dark";
  dependencies?: string[];
  onError?: (message: string | null) => void;
};

const REACT_IMPORT_MAP = {
  imports: {
    react: "https://esm.sh/react@18.3.1",
    "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
    "react/jsx-dev-runtime": "https://esm.sh/react@18.3.1/jsx-dev-runtime",
    "react-dom": "https://esm.sh/react-dom@18.3.1",
    "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
  },
};

const BASE_CSS = `
html,body{height:100%}
body{margin:0;background:var(--background);color:var(--foreground);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
${PREVIEW_ERROR_CSS}
`;

function topologicalSort(modules: TranspiledModule[]): TranspiledModule[] {
  const byPath = new Map(modules.map((m) => [m.path, m]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const out: TranspiledModule[] = [];

  const visit = (mod: TranspiledModule) => {
    if (visited.has(mod.path) || visiting.has(mod.path)) return;
    visiting.add(mod.path);
    for (const match of mod.code.matchAll(/@vfs(\/[^"']+)/g)) {
      const dep = byPath.get(match[1]);
      if (dep && dep !== mod) visit(dep);
    }
    visiting.delete(mod.path);
    visited.add(mod.path);
    out.push(mod);
  };

  modules.forEach(visit);
  return out;
}

/** Cache transpiled output per unique source so a component is only built once. */
type CachedBundle = {
  modules: TranspiledModule[];
  css: string[];
  entry: string;
  unresolved: UnresolvedImport[];
  errors: BuildError[];
};

const transpileCache = new Map<string, Promise<CachedBundle>>();

function cacheKeyFor(files: PreviewFileInput[], entry?: string): string {
  return JSON.stringify({ entry: entry ?? "", files });
}

async function transpileCached(
  files: PreviewFileInput[],
  entry: string | undefined,
  payload: string
): Promise<CachedBundle> {
  const cached = transpileCache.get(payload);
  if (cached) return cached;

  const request = (async () => {
    const response = await fetch("/api/preview/transpile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to build preview");

    const result = {
      modules: data.modules as TranspiledModule[],
      css: (data.css || []) as string[],
      entry: data.entry as string,
      unresolved: (data.unresolved || []) as UnresolvedImport[],
      errors: (data.errors || []) as BuildError[],
    };

    if (transpileCache.size > 40) {
      const oldest = transpileCache.keys().next().value;
      if (oldest) transpileCache.delete(oldest);
    }
    transpileCache.set(payload, Promise.resolve(result));
    return result;
  })();

  transpileCache.set(payload, request);
  return request;
}

/**
 * A broken build still renders a page: the Vite error overlay sits on top of
 * it with the message, the file and the code frame, so the preview pane never
 * goes silently blank.
 */
function errorDocument(
  origin: string,
  buildError: BuildError | undefined,
  unresolved: UnresolvedImport | undefined,
  theme: "light" | "dark"
): string {
  const payload = buildError
    ? {
        message: buildError.message,
        file: buildError.file,
        frame: buildError.frame,
        loc: buildError.line
          ? {
              file: buildError.file,
              line: buildError.line,
              column: buildError.column ?? 1,
            }
          : undefined,
      }
    : {
        message: `Failed to resolve import "${unresolved?.specifier ?? ""}" from "${
          unresolved?.from ?? "your project"
        }". Does the file exist?`,
        file: unresolved?.from,
      };

  return `<!DOCTYPE html>
<html lang="en" class="${theme === "dark" ? "dark" : ""}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'" />
<style>${BASE_CSS}</style>
<script>window.__shadwayBuildError = ${JSON.stringify(payload).replace(/</g, "\\u003c")};</script>
<script type="module" src="${origin}/preview/vite-overlay.js"></script>
<script>${PREVIEW_ERROR_SCRIPT}</script>
</head>
<body></body>
</html>`;
}

export function LocalPreview({
  files,
  entry,
  height = 240,
  className,
  theme = "light",
  onError,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [status, setStatus] = useState<"idle" | "building" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const urlsRef = useRef<string[]>([]);

  const payload = useMemo(() => cacheKeyFor(files, entry), [files, entry]);

  useEffect(() => {
    let cancelled = false;
    const cleanup = () => {
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current = [];
    };

    async function build() {
      setStatus("building");
      setError(null);
      onError?.(null);

      try {
        const { modules, css, unresolved, errors } = await transpileCached(files, entry, payload);
        if (cancelled) return;

        cleanup();

        const origin = window.location.origin;

        // A file that will not compile, or an `@/` import that points at
        // nothing, means there is no app to run — show the same overlay a
        // dev server would show instead of a blank canvas.
        if (errors.length || unresolved.length) {
          const htmlUrl = URL.createObjectURL(
            new Blob([errorDocument(origin, errors[0], unresolved[0], theme)], {
              type: "text/html",
            })
          );
          urlsRef.current.push(htmlUrl);
          if (iframeRef.current && !cancelled) {
            iframeRef.current.src = htmlUrl;
            setStatus("ready");
          }
          return;
        }

        const entryPath: string =
          modules.find((m) => m.path === entry)?.path ??
          entry ??
          modules[modules.length - 1]?.path;
        const blobUrls = new Map<string, string>();

        topologicalSort(modules).forEach((mod) => {
          const code = mod.code.replace(/@vfs(\/[^"']+)/g, (_match, depPath: string) => {
            const url = blobUrls.get(depPath);
            return url || "@vfs";
          });
          const url = URL.createObjectURL(
            new Blob([code], { type: "text/javascript" })
          );
          blobUrls.set(mod.path, url);
          urlsRef.current.push(url);
        });

        const entryUrl = blobUrls.get(entryPath);
        if (!entryUrl) throw new Error(`Entry file not found: ${entryPath}`);

        // So stack traces read as project paths instead of blob: URLs.
        const blobMap: Record<string, string> = {};
        blobUrls.forEach((url, path) => {
          blobMap[url] = path;
        });

        const bootstrap = `
import React from "react";
import { createRoot } from "react-dom/client";
import Component from "${entryUrl}";

const container = document.getElementById("root");
createRoot(container).render(
  React.createElement(React.StrictMode, null, React.createElement(Component))
);
`;

        const html = `<!DOCTYPE html>
<html lang="en" class="${theme === "dark" ? "dark" : ""}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="default-src 'self' blob: data: https://esm.sh https://cdn.jsdelivr.net; script-src 'self' blob: 'unsafe-inline' 'unsafe-eval' https://esm.sh https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; connect-src https://esm.sh https://cdn.jsdelivr.net; img-src 'self' data: blob: https:; frame-src 'none'; object-src 'none'" />
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<style type="text/tailwindcss">
@import "tailwindcss";
${PREVIEW_THEME_CSS}
</style>
<style>${BASE_CSS}</style>
<style>${css.join("\n")}</style>
<script type="importmap">${JSON.stringify(REACT_IMPORT_MAP)}</script>
<script>window.__shadwayBlobMap = ${JSON.stringify(blobMap)};</script>
<script>window.__shadwayUnresolved = ${JSON.stringify(unresolved)};</script>
<script type="module" src="${origin}/preview/vite-overlay.js"></script>
<script>${PREVIEW_ERROR_SCRIPT}</script>
</head>
<body>
<div id="root"></div>
<script type="module">
${bootstrap}
</script>
</body>
</html>`;

        const htmlUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
        urlsRef.current.push(htmlUrl);

        if (iframeRef.current && !cancelled) {
          iframeRef.current.src = htmlUrl;
          setStatus("ready");
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Preview failed";
        setError(message);
        setStatus("error");
        onError?.(message);
      }
    }

    void build();
    return () => {
      cancelled = true;
      cleanup();
    };
  // `payload` is a stable serialization of `files` + `entry`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, theme, onError]);

  return (
    <div className={className} style={{ position: "relative", width: "100%", height }}>
      <iframe
        ref={iframeRef}
        title="Component preview"
        sandbox="allow-scripts allow-same-origin"
        style={{ width: "100%", height: "100%", border: 0, background: "transparent" }}
      />
      {status === "building" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-xs text-muted-foreground">
          Building preview...
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-start justify-center overflow-auto bg-zinc-950/60 p-4">
          <div className="mt-1 w-full max-w-xl overflow-hidden rounded-lg border border-red-500/45 bg-zinc-900 text-left shadow-2xl">
            <div className="flex items-center gap-2 border-b border-red-500/35 bg-red-500/12 px-3 py-2 text-xs font-semibold text-red-300">
              <span aria-hidden className="text-[10px]">✕</span>
              Build error
            </div>
            <pre className="max-h-[50vh] overflow-auto p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-red-200">
              {error}
            </pre>
            <p className="border-t border-zinc-700/60 bg-zinc-950/60 px-3 py-2 text-[10px] text-zinc-500">
              Fix the error in the studio — the preview rebuilds as you edit.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}