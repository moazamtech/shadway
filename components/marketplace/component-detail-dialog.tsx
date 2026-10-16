"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Heart,
  Share2,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BundledPreview } from "@/components/preview/bundled-preview";
import { InstallTabs } from "@/components/marketplace/install-tabs";
import { useOrigin } from "@/hooks/use-origin";
import type { MarketplaceCardItem } from "@/components/marketplace/component-card";

type Tab = "preview" | "code" | "install";

/**
 * The detail dialog the feed opens on card click.
 *
 * A component is judged in a second, so the dialog leads with a live preview
 * and keeps the install command, the code and the metadata one tab away — the
 * detail page stays a separate, linkable destination rather than the only way
 * to see a component.
 */
export function ComponentDetailDialog({
  item,
  open,
  onOpenChange,
  saved,
  liked,
  likeCount,
  onToggleSave,
  onToggleLike,
}: {
  item: MarketplaceCardItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saved: boolean;
  liked: boolean;
  likeCount: number;
  onToggleSave: (slug: string) => void;
  onToggleLike: (slug: string) => void;
}) {
  // Rules of Hooks: the hooks below must run on every render, so they live
  // above the early return instead of after it. TypeScript cannot carry the
  // `item` narrowing across those hook closures — the optional chaining in
  // the hooks handles that, and `current` (re-declared after the bail-out)
  // is narrowed by construction.
  const router = useRouter();
  const origin = useOrigin();
  const [tab, setTab] = useState<Tab>("preview");
  const [code, setCode] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);

  // Reset to the preview tab each time a new component opens.
  const activeSlug = item?.slug;
  useEffect(() => {
    if (open) {
      setTab("preview");
      setCopied(null);
    }
  }, [open, activeSlug]);

  // The code tab is lazy: the feed never needs it, and a component's source can
  // be large. Fetch it on first open of the tab only.
  useEffect(() => {
    if (!open || tab !== "code" || !activeSlug || code) return;
    let cancelled = false;
    setCodeLoading(true);
    fetch(`/api/components/${encodeURIComponent(activeSlug)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setCode(data?.item?.code ?? "");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCodeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tab, activeSlug, code]);

  // The dialog renders nothing when there is no component to show.
  if (!item) return null;
  const current: MarketplaceCardItem = item;

  const installCommand = `npx shadcn@latest add ${origin}/r/${current.slug}`;
  const pageUrl = `${origin}/c/${current.slug}`;

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {}
  }

  async function share() {
    if (!current) return;
    const payload = { title: current.title, text: current.description || current.title, url: pageUrl };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        // A cancelled share falls through to the copy fallback below.
      }
    }
    await copy(pageUrl, "share");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92dvh] max-w-none gap-0 overflow-hidden rounded-xl border-border/60 p-0 sm:max-w-[min(1100px,94vw)]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{current.title}</DialogTitle>
        <DialogDescription className="sr-only">
          {current.description || `Component ${current.title} by ${current.author.name}`}
        </DialogDescription>

        <div className="flex h-full max-h-[92dvh] flex-col">
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/40 bg-muted text-[10px] font-bold uppercase text-muted-foreground"
              aria-hidden="true"
            >
              {current.author.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.author.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                current.author.username.slice(0, 2)
              )}
            </span>

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold tracking-tight">
                {current.title}
              </h2>
              <Link
                href={`/u/${current.author.username}`}
                className="truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                {current.author.name} · @{current.author.username}
              </Link>
            </div>

            {current.category ? (
              <span className="hidden rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase sm:inline">
                {current.category}
              </span>
            ) : null}

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                ×
              </span>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0 items-center gap-1 border-b border-border px-4 sm:px-5">
            {(
              [
                { id: "preview", label: "Preview" },
                { id: "code", label: "Code" },
                { id: "install", label: "Install" },
              ] as { id: Tab; label: string }[]
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={tab === option.id}
                onClick={() => setTab(option.id)}
                className={cn(
                  "relative px-3 py-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  tab === option.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
                {tab === option.id ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-2 -bottom-px h-px bg-foreground"
                  />
                ) : null}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "preview" ? (
              <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_320px]">
                <div className="relative min-h-[300px] bg-muted/30 md:min-h-[460px]">
                  <BundledPreview slug={current.slug} height="100%" />
                </div>

                <aside className="space-y-5 border-t border-border p-4 sm:p-5 md:border-t-0 md:border-l">
                  {current.description ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {current.description}
                    </p>
                  ) : null}

                  <div className="flex items-center gap-2">
                    <Button
                      variant={liked ? "secondary" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => onToggleLike(current.slug)}
                      aria-pressed={liked}
                    >
                      <Heart
                        className={cn("h-3.5 w-3.5", liked && "fill-current text-rose-500")}
                      />
                      {likeCount}
                    </Button>
                    <Button
                      variant={saved ? "secondary" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => onToggleSave(current.slug)}
                      aria-pressed={saved}
                    >
                      <Bookmark className={cn("h-3.5 w-3.5", saved && "fill-current")} />
                      {saved ? "Saved" : "Save"}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-1.5 pr-2 pl-3">
                      <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <code className="min-w-0 flex-1 truncate font-mono text-xs">
                        {installCommand}
                      </code>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Copy install command"
                        onClick={() => copy(installCommand, "install")}
                      >
                        {copied === "install" ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Download className="h-3 w-3" aria-hidden="true" />
                      <span className="tabular-nums">{current.installs}</span>
                      <span>installs</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => void share()}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      {copied === "share" ? "Link copied" : "Share"}
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        onOpenChange(false);
                        router.push(`/c/${current.slug}`);
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open full page
                    </Button>
                  </div>

                  {current.tags.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {current.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </aside>
              </div>
            ) : null}

            {tab === "code" ? (
              <div className="relative">
                <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 sm:px-5">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Source
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copy(code, "code")}
                    disabled={!code}
                  >
                    {copied === "code" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied === "code" ? "Copied" : "Copy"}
                  </Button>
                </div>
                {codeLoading ? (
                  <div className="p-6 text-sm text-muted-foreground">Loading source…</div>
                ) : (
                  <pre className="max-h-[52vh] overflow-auto p-4 font-mono text-xs leading-6 sm:p-5">
                    <code>{code || "No source available."}</code>
                  </pre>
                )}
              </div>
            ) : null}

            {tab === "install" ? (
              <div className="p-4 sm:p-5">
                <InstallTabs
                  slug={current.slug}
                  dependencies={[]}
                  registryDependencies={[]}
                />
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
