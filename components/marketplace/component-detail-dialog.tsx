"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Bookmark,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Heart,
  Moon,
  Share2,
  Sun,
  X,
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
import { InstallCommand } from "@/components/marketplace/install-command";
import { InstallTabs } from "@/components/marketplace/install-tabs";
import { useOrigin } from "@/hooks/use-origin";
import type { MarketplaceCardItem } from "@/components/marketplace/component-card";

type Tab = "preview" | "code" | "install";

const TABS: { id: Tab; label: string }[] = [
  { id: "preview", label: "Preview" },
  { id: "code", label: "Code" },
  { id: "install", label: "Install" },
];

/** Small square icon button shared by the header actions. */
const HEADER_BUTTON =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.96]";

/**
 * The detail dialog the feed opens on card click.
 *
 * A component is judged in a second, so the dialog is built the way a browser
 * is: a real, edge-to-edge preview with the metadata and the install line kept
 * to a narrow rail beside it. The code and the fuller install surface stay one
 * tab away, and the detail page remains a separate, linkable destination.
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
  const { resolvedTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("preview");
  const [code, setCode] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");

  // Reset to the preview tab each time a new component opens.
  const activeSlug = item?.slug;
  useEffect(() => {
    if (open) {
      setTab("preview");
      setCopied(null);
    }
  }, [open, activeSlug]);

  // The preview follows the site theme until the reader overrides it.
  useEffect(() => {
    if (resolvedTheme) setPreviewTheme(resolvedTheme === "dark" ? "dark" : "light");
  }, [resolvedTheme]);

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

  const registryUrl = `${origin}/r/${current.slug}`;
  const pageUrl = `${origin}/c/${current.slug}`;

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch {}
  }

  async function share() {
    const payload = {
      title: current.title,
      text: current.description || current.title,
      url: pageUrl,
    };
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
        className="flex h-[min(880px,92dvh)] w-[min(1200px,94vw)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border-border/60 p-0 shadow-2xl sm:max-w-none"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{current.title}</DialogTitle>
        <DialogDescription className="sr-only">
          {current.description || `Component ${current.title} by ${current.author.name}`}
        </DialogDescription>

        {/* Header — who made it on the left, what you can do with it on the right. */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 pr-2.5 pl-4">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/50 bg-muted text-[10px] font-bold text-muted-foreground uppercase"
            aria-hidden="true"
          >
            {current.author.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.author.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              current.author.username.slice(0, 2)
            )}
          </span>

          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <h2 className="truncate text-[15px] leading-tight font-semibold tracking-tight">
              {current.title}
            </h2>
            <Link
              href={`/u/${current.author.username}`}
              className="truncate text-xs leading-tight text-muted-foreground transition-colors hover:text-foreground"
            >
              {current.author.name}
            </Link>
          </div>

          {current.category ? (
            <span className="hidden shrink-0 rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase lg:inline">
              {current.category}
            </span>
          ) : null}

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => setPreviewTheme((t) => (t === "dark" ? "light" : "dark"))}
              title={`Preview in ${previewTheme === "dark" ? "light" : "dark"}`}
              className={HEADER_BUTTON}
            >
              {previewTheme === "dark" ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onToggleLike(current.slug)}
              aria-pressed={liked}
              title={liked ? "Remove like" : "Like"}
              className={cn(
                HEADER_BUTTON,
                "w-auto gap-1.5 px-2",
                liked && "text-rose-500 hover:text-rose-500"
              )}
            >
              <Heart className={cn("h-4 w-4", liked && "fill-current")} aria-hidden="true" />
              <span className="text-xs font-medium tabular-nums">{likeCount}</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleSave(current.slug)}
              aria-pressed={saved}
              title={saved ? "Saved" : "Save"}
              className={cn(HEADER_BUTTON, saved && "text-foreground")}
            >
              <Bookmark className={cn("h-4 w-4", saved && "fill-current")} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => void share()}
              title={copied === "share" ? "Link copied" : "Share"}
              className={HEADER_BUTTON}
            >
              {copied === "share" ? (
                <Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              ) : (
                <Share2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            <span className="mx-1 h-4 w-px bg-border/70" aria-hidden="true" />

            <Button
              size="sm"
              className="h-8 gap-1.5 rounded-lg px-3 text-[12px] shadow-xs"
              onClick={() => {
                onOpenChange(false);
                router.push(`/c/${current.slug}`);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Open page
            </Button>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className={cn(HEADER_BUTTON, "ml-0.5")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Tabs — a quiet segmented rail, not a second navigation bar. */}
        <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border/60 px-3">
          {TABS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={tab === option.id}
              onClick={() => setTab(option.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                tab === option.id
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto md:overflow-hidden">
          {tab === "preview" ? (
            <div className="grid md:h-full md:grid-cols-[minmax(0,1fr)_340px]">
              <div className="relative min-h-[320px] bg-muted/30 md:min-h-0">
                <BundledPreview slug={current.slug} height="100%" theme={previewTheme} />
              </div>

              <aside className="flex flex-col gap-5 border-t border-border/60 p-5 md:overflow-y-auto md:border-t-0 md:border-l">
                {current.description ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {current.description}
                  </p>
                ) : null}

                <InstallCommand registryUrl={registryUrl} />

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="tabular-nums">{current.installs}</span>
                    installs
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="tabular-nums">{current.views}</span>
                    views
                  </span>
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
            <div className="flex h-full flex-col">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
                <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {current.slug}.tsx
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 rounded-lg px-2.5 text-[11px]"
                  onClick={() => copy(code, "code")}
                  disabled={!code}
                >
                  {copied === "code" ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {copied === "code" ? "Copied" : "Copy"}
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                {codeLoading ? (
                  <p className="p-5 text-sm text-muted-foreground">Loading source…</p>
                ) : (
                  <pre className="p-4 font-mono text-xs leading-6 sm:p-5">
                    <code>{code || "No source available."}</code>
                  </pre>
                )}
              </div>
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
      </DialogContent>
    </Dialog>
  );
}
