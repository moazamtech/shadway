"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TranspiledModule } from "@/lib/preview/transpile";

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

const SHADCN_THEME_CSS = `
:root{
  --background:0 0% 100%;--foreground:240 10% 3.9%;
  --card:0 0% 100%;--card-foreground:240 10% 3.9%;
  --popover:0 0% 100%;--popover-foreground:240 10% 3.9%;
  --primary:240 5.9% 10%;--primary-foreground:0 0% 98%;
  --secondary:240 4.8% 95.9%;--secondary-foreground:240 5.9% 10%;
  --muted:240 4.8% 95.9%;--muted-foreground:240 3.8% 46.1%;
  --accent:240 4.8% 95.9%;--accent-foreground:240 5.9% 10%;
  --destructive:0 84.2% 60.2%;--destructive-foreground:0 0% 100%;
  --border:240 5.9% 90%;--input:240 5.9% 90%;--ring:240 5% 64.9%;--radius:.5rem;
}
.dark{
  --background:240 10% 3.9%;--foreground:0 0% 98%;
  --card:240 10% 3.9%;--card-foreground:0 0% 98%;
  --popover:240 10% 3.9%;--popover-foreground:0 0% 98%;
  --primary:0 0% 98%;--primary-foreground:240 5.9% 10%;
  --secondary:240 3.7% 15.9%;--secondary-foreground:0 0% 98%;
  --muted:240 3.7% 15.9%;--muted-foreground:240 5% 64.9%;
  --accent:240 3.7% 15.9%;--accent-foreground:0 0% 98%;
  --destructive:0 62.8% 30.6%;--destructive-foreground:0 0% 98%;
  --border:240 3.7% 15.9%;--input:240 3.7% 15.9%;--ring:240 4.9% 83.9%;
}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:hsl(var(--background));color:hsl(var(--foreground));font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
.twp-error{font-family:ui-monospace,monospace;font-size:12px;padding:12px;color:#ef4444;white-space:pre-wrap;line-height:1.5}
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
type CachedBundle = { modules: TranspiledModule[]; css: string[]; entry: string };

const transpileCache = new Map<string, Promise<CachedBundle>>();

function cacheKeyFor(files: PreviewFileInput[], entry?: string): string {
  return JSON.stringify({ entry: entry ?? "", files });
}

async function transpileCached(
  files: PreviewFileInput[],
  entry: string | undefined,
  payload: string
): Promise<{ modules: TranspiledModule[]; css: string[] }> {
  const cached = transpileCache.get(payload);
  if (cached) return cached as Promise<{ modules: TranspiledModule[]; css: string[] }>;

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
        const { modules, css } = await transpileCached(files, entry, payload);
        if (cancelled) return;

        cleanup();

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
<meta http-equiv="Content-Security-Policy" content="default-src 'self' blob: data: https://esm.sh https://cdn.tailwindcss.com; script-src 'self' blob: 'unsafe-inline' 'unsafe-eval' https://esm.sh https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; connect-src https://esm.sh https://cdn.tailwindcss.com; img-src 'self' data: blob: https:; frame-src 'none'; object-src 'none'" />
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
  darkMode: ["class"],
  theme: { extend: {
    colors: {
      background: "hsl(var(--background))",
      foreground: "hsl(var(--foreground))",
      card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
      secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
      muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
      accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
      destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
      border: "hsl(var(--border))",
      input: "hsl(var(--input))",
      ring: "hsl(var(--ring))"
    },
    borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" }
  }}
};
</script>
<style>${SHADCN_THEME_CSS}</style>
<style>${css.join("\n")}</style>
<script type="importmap">${JSON.stringify(REACT_IMPORT_MAP)}</script>
</head>
<body>
<div id="root"></div>
<script type="module">
${bootstrap}
</script>
<script type="module">
  window.addEventListener("error", (event) => {
    const el = document.getElementById("root");
    if (el && !el.childElementCount) {
      el.innerHTML = '<pre class="twp-error"></pre>';
      el.firstElementChild.textContent = String(event.message || "Runtime error");
    }
  });
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
        <div className="absolute inset-0 flex items-center justify-center bg-background p-3">
          <pre className="max-h-full overflow-auto whitespace-pre-wrap text-left font-mono text-[11px] leading-4 text-destructive">
            {error}
          </pre>
        </div>
      )}
    </div>
  );
}