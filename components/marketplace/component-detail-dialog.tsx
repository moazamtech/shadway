"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Copy,
  ExternalLink,
  FileText,
  Heart,
  Link2,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BundledPreview } from "@/components/preview/bundled-preview";
import { useOrigin } from "@/hooks/use-origin";
import type { MarketplaceCardItem } from "@/components/marketplace/component-card";

/**
 * The showcase the feed opens on a card.
 *
 * A component is judged by how it looks, so the dialog is not a panel with a
 * picture in it: the page dims, the component takes the whole screen, and the
 * only things left on the glass are the ones you act with — page through the
 * grid, take the source, go to the page.
 *
 * The bar at the bottom is the whole interface. It floats over the stage
 * rather than sitting in a header, because a header would cut the component's
 * own height in half to hold a row of icons. The code and the install line
 * are not here: they live on the detail page, where there is room to read
 * them.
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
  onPrev,
  onNext,
}: {
  item: MarketplaceCardItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saved: boolean;
  liked: boolean;
  likeCount: number;
  onToggleSave: (slug: string) => void;
  onToggleLike: (slug: string) => void;
  /** Steps to the previous or next component in the grid. */
  onPrev?: () => void;
  onNext?: () => void;
}) {
  // Rules of Hooks: the hooks below must run on every render, so they live
  // above the early return instead of after it. TypeScript cannot carry the
  // `item` narrowing across those hook closures — the optional chaining in
  // the hooks handles that, and `current` (re-declared after the bail-out)
  // is narrowed by construction.
  const router = useRouter();
  const origin = useOrigin();
  const { resolvedTheme } = useTheme();
  const [copied, setCopied] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");

  // Reset the copied state each time a new component opens.
  const activeSlug = item?.slug;
  useEffect(() => {
    if (open) {
      setCopied(null);
    }
  }, [open, activeSlug]);

  // The preview follows the site theme until the reader overrides it.
  useEffect(() => {
    if (resolvedTheme) setPreviewTheme(resolvedTheme === "dark" ? "dark" : "light");
  }, [resolvedTheme]);

  // The dialog renders nothing when there is no component to show.
  if (!item) return null;
  const current: MarketplaceCardItem = item;

  const registryUrl = `${origin}/r/${current.slug}`;
  const pageUrl = `${origin}/c/${current.slug}`;
  /** The published document, on an address of its own. */
  const artifactUrl = `${origin}/p/${current.slug}`;

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch {}
  }

  /**
   * The source is fetched at the moment it is asked for, not kept in the
   * card: the feed's cards are deliberately light, and a dialog that opened
   * with every component's source in memory would put the whole registry in
   * the tab.
   */
  async function copySource(withDemo: boolean) {
    try {
      const response = await fetch(`/api/components/${encodeURIComponent(current.slug)}`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      const source = typeof data.code === "string" ? data.code : "";
      const demo = typeof data.demoCode === "string" ? data.demoCode : "";
      if (!source) {
        setCopied("none");
        window.setTimeout(() => setCopied((c) => (c === "none" ? null : c)), 1600);
        return;
      }
      const text = withDemo && demo ? `${source}\n\n${demo}` : source;
      await copy(text, withDemo ? "code+demo" : "code");
    } catch {
      setCopied("none");
      window.setTimeout(() => setCopied((c) => (c === "none" ? null : c)), 1600);
    }
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
        showCloseButton={false}
        className="fixed inset-0 top-0 left-0 z-50 flex h-dvh max-h-none w-screen max-w-none translate-none flex-col overflow-hidden rounded-none border-0 bg-black/75 p-0 shadow-none backdrop-blur-sm sm:max-w-none"
      >
        <DialogTitle className="sr-only">{current.title}</DialogTitle>
        <DialogDescription className="sr-only">
          {current.description || `Component ${current.title} by ${current.author.name}`}
        </DialogDescription>

        {/* Who made it — the one piece of identity the stage keeps. */}
        <div className="absolute top-4 left-4 z-30 flex items-center gap-2.5 sm:top-5 sm:left-6">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/10 text-[10px] font-bold text-white/80 uppercase"
            aria-hidden="true"
          >
            {current.author.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.author.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              current.author.username.slice(0, 2)
            )}
          </span>
          <span className="truncate text-sm font-medium text-white/90">
            {current.title}
          </span>
          {current.category ? (
            <span className="hidden shrink-0 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-medium tracking-[0.1em] text-white/70 uppercase sm:inline">
              {current.category}
            </span>
          ) : null}
        </div>

        {/* The stage. */}
        <div className="flex min-h-0 flex-1 items-center justify-center px-3 pt-16 pb-28 sm:px-6 sm:pt-20 sm:pb-32">
          <div className="relative h-full w-full max-w-[1400px] overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-2xl">
            <BundledPreview
              slug={current.slug}
              height="100%"
              theme={previewTheme}
              poster={current.thumbnailUrl}
            />
          </div>
        </div>

        {/* Close — the corner the hand goes to, not a button in a row. */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
          className="absolute top-4 right-4 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none sm:top-5 sm:right-6"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Page through the grid. */}
        {onPrev ? (
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous component"
            className="absolute top-1/2 left-2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none sm:left-4"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}
        {onNext ? (
          <button
            type="button"
            onClick={onNext}
            aria-label="Next component"
            className="absolute top-1/2 right-2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none sm:right-4"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}

        {/* The bar: what it is, and what you can do with it. */}
        <div className="absolute bottom-5 left-1/2 z-30 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/70 p-1 backdrop-blur-md">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              router.push(`/c/${current.slug}`);
            }}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
          >
            Open
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
              >
                {copied === "code" || copied === "code+demo" ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {copied === "code" || copied === "code+demo" ? "Copied" : "Copy code"}
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-72">
              <DropdownMenuItem onSelect={() => void copySource(false)}>
                <Clipboard className="h-4 w-4" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">Copy code</p>
                  <p className="text-xs text-muted-foreground">
                    The raw source of the component.
                  </p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copySource(true)}>
                <Copy className="h-4 w-4" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">Copy code + demo</p>
                  <p className="text-xs text-muted-foreground">
                    The component together with the demo that shows it working.
                  </p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copy(pageUrl, "url")}>
                <Link2 className="h-4 w-4" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">Copy page link</p>
                  <p className="text-xs text-muted-foreground">
                    The address this component lives at.
                  </p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copy(registryUrl, "install")}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">Copy registry URL</p>
                  <p className="text-xs text-muted-foreground">
                    The address the shadcn CLI installs from.
                  </p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copy(artifactUrl, "artifact")}>
                <FileText className="h-4 w-4" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">Copy preview link</p>
                  <p className="text-xs text-muted-foreground">
                    The published document on its own address.
                  </p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="mx-1 h-5 w-px bg-white/15" aria-hidden="true" />

          <button
            type="button"
            onClick={() => setPreviewTheme((t) => (t === "dark" ? "light" : "dark"))}
            title={`Preview in ${previewTheme === "dark" ? "light" : "dark"}`}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
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
              "flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none",
              liked && "text-rose-400 hover:text-rose-400"
            )}
          >
            <Heart className={cn("h-4 w-4", liked && "fill-current")} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onToggleSave(current.slug)}
            aria-pressed={saved}
            title={saved ? "Saved" : "Save"}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none",
              saved && "text-white"
            )}
          >
            <Bookmark className={cn("h-4 w-4", saved && "fill-current")} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => void share()}
            title={copied === "share" ? "Link copied" : "Share"}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
          >
            {copied === "share" ? (
              <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            ) : (
              <Share2 className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
