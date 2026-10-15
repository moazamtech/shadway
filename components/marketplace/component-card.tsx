"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, Check, Copy, Download, Eye, Heart, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export type MarketplaceCardItem = {
  slug: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  author: { name: string; username: string; avatar?: string };
  tags: string[];
  installs: number;
  views: number;
  likes: number;
  category?: string;
  createdAt?: string;
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const then = Date.parse(dateStr);
  if (Number.isNaN(then)) return "";
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/**
 * Static, lightweight marketplace card.
 * Uses the cover image captured at publish time so the feed never boots a
 * bundler. Hovering a video plays it inline.
 */
export function ComponentCard({
  item,
  onSave,
  savedSlugs,
}: {
  item: MarketplaceCardItem;
  onSave?: (slug: string) => void;
  savedSlugs?: Record<string, boolean>;
}) {
  const [showVideo, setShowVideo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const saved = Boolean(savedSlugs?.[item.slug]);
  const hasCover = Boolean(item.thumbnailUrl) && !coverFailed;

  async function copyInstall() {
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "https://shadway.com";
      await navigator.clipboard.writeText(
        `npx shadcn@latest add ${origin}/r/${item.slug}`
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  return (
    <article className="group flex flex-col">
      {/* Cover — framed preview with border so it looks intentional on dark. */}
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-border/40 bg-background transition-all duration-200 group-hover:border-foreground/20 group-hover:shadow-lg group-hover:shadow-black/20">
        <Link
          href={`/c/${item.slug}`}
          className="absolute inset-0 block outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`View ${item.title}`}
        >
          {showVideo && item.videoUrl ? (
            <video
              src={item.videoUrl}
              className="h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              aria-hidden="true"
            />
          ) : hasCover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnailUrl}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              onError={() => setCoverFailed(true)}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.01]"
            />
          ) : (
            <FallbackPreview title={item.title} tags={item.tags} category={item.category} />
          )}
        </Link>

        {/* Category badge — top left. */}
        {item.category && (
          <span className="absolute left-1.5 top-1.5 z-10 rounded bg-background/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-foreground/70 backdrop-blur-sm">
            {item.category}
          </span>
        )}

        {/* Video indicator. */}
        {item.videoUrl && (
          <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded bg-background/80 text-foreground/70 backdrop-blur-sm">
            <Play className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
          </span>
        )}

        {/* Hover actions — bottom right. */}
        <div className="absolute bottom-1.5 right-1.5 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {onSave && (
            <button
              type="button"
              title={saved ? "Remove from saved" : "Save for later"}
              aria-label={saved ? "Remove from saved" : "Save for later"}
              aria-pressed={saved}
              onClick={() => onSave(item.slug)}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-background/80 text-foreground/70 backdrop-blur-sm transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Bookmark className={cn("h-3 w-3", saved && "fill-current")} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            title={copied ? "Copied" : "Copy install command"}
            aria-label={copied ? "Install command copied" : "Copy install command"}
            onClick={() => void copyInstall()}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-background/80 text-foreground/70 backdrop-blur-sm transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="h-3 w-3" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-2 flex items-start gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/40 bg-muted/40 text-[9px] font-bold uppercase text-muted-foreground"
          aria-hidden="true"
        >
          {item.author.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.author.avatar}
              alt=""
              className="h-full w-full rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            item.author.username.slice(0, 2)
          )}
        </span>

        <div className="min-w-0 flex-1">
          <Link
            href={`/c/${item.slug}`}
            className="block truncate rounded-sm text-[13px] font-medium leading-tight outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.title}
          </Link>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Link
              href={`/u/${item.author.username}`}
              className="truncate rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.author.name}
            </Link>
            {item.createdAt && (
              <>
                <span aria-hidden="true">·</span>
                <span className="shrink-0">{timeAgo(item.createdAt)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1" title={`${item.views} views`}>
          <Eye className="h-3 w-3" aria-hidden="true" />
          {formatCount(item.views)}
        </span>
        <span className="flex items-center gap-1" title={`${item.likes} likes`}>
          <Heart className="h-3 w-3" aria-hidden="true" />
          {formatCount(item.likes)}
        </span>
        <span className="flex items-center gap-1" title={`${item.installs} installs`}>
          <Download className="h-3 w-3" aria-hidden="true" />
          {formatCount(item.installs)}
        </span>
      </div>
    </article>
  );
}

function FallbackPreview({
  title,
  tags,
  category,
}: {
  title: string;
  tags: string[];
  category?: string;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted/30 to-background p-4 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/40 bg-background/50">
        <svg
          className="h-5 w-5 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v13.5A1.5 1.5 0 003.75 21z"
          />
        </svg>
      </div>
      <p className="line-clamp-2 text-xs font-medium text-muted-foreground">{title}</p>
    </div>
  );
}
