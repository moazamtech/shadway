"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, FileCode2, Loader2 } from "lucide-react";

import { CodeBlock } from "@/components/ai-elements/code-block";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { reachableSourceFiles } from "@/lib/registry/sources";
import { resolveComponentPath } from "@/lib/studio/project";
import {
  DEFAULT_COMPONENT_PATH,
  DEFAULT_DEMO_PATH,
  DEFAULT_STYLE_PATH,
} from "@/lib/studio/starter";

/**
 * The stored project behind a component — the same shape the publish payload
 * carries, so the tabs read exactly what the build compiled.
 */
export type ComponentSource = {
  code: string;
  /** Where the author keeps the component. Absent on older records. */
  componentPath?: string;
  demoCode?: string;
  styleCode?: string;
  files?: { path: string; content: string }[];
};

export type SourceFile = {
  /** Project-absolute, e.g. `/components/hero-section.tsx`. */
  path: string;
  /** What the tab shows: the file name, like every editor's tab strip. */
  name: string;
  content: string;
  language: string;
};

/** The highlighter language a path is rendered as. */
function languageForPath(path: string) {
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (/\.(m?js|jsx)$/.test(path)) return "javascript";
  return "tsx";
}

function normalize(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Every file in a published component, in the order a reader wants them.
 *
 * The component leads, wherever the author put it — the whole point of
 * publishing is the component, not the scaffolding around it. The demo page
 * follows, because that is how it is meant to be used, and the support files
 * and stylesheet come last. A file is listed once: a helper that happens to
 * sit at the component's path is the component, not a duplicate.
 */
export function sourceFilesOf(item: ComponentSource): SourceFile[] {
  const map: Record<string, string> = {};
  for (const file of item.files ?? []) {
    if (!file?.content) continue;
    map[normalize(file.path)] = file.content;
  }
  if (item.demoCode?.trim()) map[DEFAULT_DEMO_PATH] = item.demoCode;

  const componentPath =
    item.componentPath ??
    resolveComponentPath({ ...map, [DEFAULT_COMPONENT_PATH]: item.code });

  const files: SourceFile[] = [];
  const seen = new Set<string>();

  const push = (path: string, content?: string) => {
    if (!content?.trim() || seen.has(path)) return;
    seen.add(path);
    files.push({
      path,
      name: path.slice(path.lastIndexOf("/") + 1),
      content,
      language: languageForPath(path),
    });
  };

  /**
   * Only the files the component reaches. The stored map is the author's whole
   * project: the starter's `components/component.tsx` is still in it long after
   * it was replaced, and it is not this component — listing it put a scaffold
   * one click away from "Copy".
   */
  for (const file of reachableSourceFiles({
    code: item.code,
    componentPath,
    files: item.files ?? [],
  })) {
    push(file.path, file.content);
  }

  push(DEFAULT_DEMO_PATH, item.demoCode);
  push(DEFAULT_STYLE_PATH, item.styleCode);

  return files;
}

/**
 * The code tab: one tab per file, the way a component is actually read.
 *
 * A published component is rarely one file — a demo, a couple of helpers and
 * the stylesheet travel with it — and collapsing all of that into a single
 * blob hides the part that matters. The source is fetched on mount, so the
 * feed never pays for it, and only the visible file is highlighted.
 */
export function ComponentCodeTabs({
  slug,
  source,
  className,
}: {
  slug: string;
  /** Already-loaded source, when the caller has it. Skips the fetch. */
  source?: ComponentSource;
  className?: string;
}) {
  // Keyed by slug: a dialog can point at another component without unmounting,
  // and the previous answer must not be shown while the next one loads.
  const [fetched, setFetched] = useState<{ slug: string; source: ComponentSource } | null>(null);
  const [failedSlug, setFailedSlug] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // A caller that already holds the source (the detail page does) wins, always.
  const loaded = source ?? (fetched?.slug === slug ? fetched.source : null);
  const failed = !loaded && failedSlug === slug;

  useEffect(() => {
    if (source || fetched?.slug === slug || failedSlug === slug) return;
    let cancelled = false;

    fetch(`/api/components/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.item) setFetched({ slug, source: data.item as ComponentSource });
        else setFailedSlug(slug);
      })
      .catch(() => {
        if (!cancelled) setFailedSlug(slug);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, source, fetched, failedSlug]);

  const files = useMemo(() => (loaded ? sourceFilesOf(loaded) : []), [loaded]);
  const active = files.find((file) => file.path === activePath) ?? files[0] ?? null;

  async function copyActive() {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  if (!loaded) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[240px] items-center justify-center gap-2 text-sm text-muted-foreground",
          className
        )}
      >
        {failed ? (
          "No source available."
        ) : (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading source…
          </>
        )}
      </div>
    );
  }

  if (!active) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[240px] items-center justify-center text-sm text-muted-foreground",
          className
        )}
      >
        No source available.
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {/* Tab rail — the file strip of an editor, not a second navigation bar. */}
      <div
        role="tablist"
        aria-label="Component files"
        className="flex shrink-0 items-stretch gap-0.5 overflow-x-auto border-b border-border/60 bg-muted/40 px-2 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {files.map((file) => {
          const isActive = file.path === active.path;
          return (
            <button
              key={file.path}
              type="button"
              role="tab"
              aria-selected={isActive}
              title={file.path}
              onClick={() => {
                setActivePath(file.path);
                setCopied(false);
              }}
              className={cn(
                "shrink-0 rounded-t-md border border-b-0 px-3 py-1.5 font-mono text-[11px] whitespace-nowrap transition-[color,background-color,border-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                isActive
                  ? "border-border/60 bg-background text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              {file.name}
            </button>
          );
        })}
      </div>

      {/* Where the active file lives, and the one action a reader wants. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 py-2">
        <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
          {active.path.replace(/^\//, "")}
        </span>
        <span className="hidden shrink-0 text-[11px] text-muted-foreground/70 sm:inline">
          {files.length} file{files.length === 1 ? "" : "s"}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 shrink-0 gap-1.5 rounded-lg px-2.5 text-[11px]"
          onClick={() => void copyActive()}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <CodeBlock
          code={active.content}
          language={active.language}
          showLineNumbers
          className="rounded-none border-0 bg-transparent"
        />
      </div>
    </div>
  );
}
