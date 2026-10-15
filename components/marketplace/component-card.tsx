"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, Check, Copy, Download, Eye, Heart, Play, Video } from "lucide-react";
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
    <article
      className="group flex flex-col"
      onMouseEnter={() => setShowVideo(true)}
      onMouseLeave={() => setShowVideo(false)}
    >
      {/* Cover — reserved 16:10 box keeps the grid from shifting while covers load. */}
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border/60 bg-muted/30 transition-all duration-300 group-hover:border-foreground/15 group-hover:shadow-lg group-hover:shadow-black/20 group-focus-within:border-foreground/15">
        <Link
          href={`/c/${item.slug}`}
          className="absolute inset-0 block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <FallbackPreview title={item.title} tags={item.tags} />
          )}
        </Link>

        {/* Bottom gradient for legibility of overlaid stats. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Category badge — top left. */}
        {item.category && (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/90 backdrop-blur-sm">
            {item.category}
          </span>
        )}

        {/* Video indicator. */}
        {item.videoUrl && (
          <span className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-1 text-white/90 backdrop-blur-sm">
            <Play className="h-3 w-3 fill-current" aria-hidden="true" />
            <span className="sr-only">Has a demo video</span>
          </span>
        )}

        {/* View count — bottom right on the cover. */}
        {item.views > 0 && (
          <span className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-sm">
            <Eye className="h-3 w-3" aria-hidden="true" />
            {formatCount(item.views)}
          </span>
        )}

        {/* Actions sit outside the link so they are never nested interactives.
            Always visible on touch, revealed on hover/focus elsewhere. */}
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-10 flex gap-1.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          {onSave && (
            <button
              type="button"
              title={saved ? "Remove from saved" : "Save for later"}
              aria-label={saved ? "Remove from saved" : "Save for later"}
              aria-pressed={saved}
              onClick={() => onSave(item.slug)}
              className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-white/90 backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Bookmark
                className={cn("h-3.5 w-3.5", saved && "fill-current")}
                aria-hidden="true"
              />
            </button>
          )}
          <button
            type="button"
            title={copied ? "Copied" : "Copy install command"}
            aria-label={copied ? "Install command copied" : "Copy install command"}
            onClick={() => void copyInstall()}
            className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-white/90 backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Meta row — avatar, title, author, stats. */}
      <div className="mt-3 flex items-start gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-gradient-to-br from-muted to-muted/50 text-[11px] font-bold uppercase text-muted-foreground"
          aria-hidden="true"
        >
          {item.author.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.author.avatar}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            item.author.username.slice(0, 2)
          )}
        </span>

        <div className="min-w-0 flex-1">
          <Link
            href={`/c/${item.slug}`}
            className="block truncate rounded-sm text-sm font-semibold leading-snug outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {item.title}
          </Link>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link
              href={`/u/${item.author.username}`}
              className="truncate rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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

        <div className="flex shrink-0 items-center gap-2.5 text-[11px] text-muted-foreground">
          {item.likes > 0 && (
            <span className="flex items-center gap-0.5" title={`${item.likes} likes`}>
              <Heart className="h-3 w-3" aria-hidden="true" />
              {formatCount(item.likes)}
            </span>
          )}
          <span className="flex items-center gap-0.5" title={`${item.installs} installs`}>
            <Download className="h-3 w-3" aria-hidden="true" />
            {formatCount(item.installs)}
          </span>
        </div>
      </div>
    </article>
  );
}

function FallbackPreview({ title, tags }: { title: string; tags: string[] }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted/60 to-background p-6 text-center">
      <div className="max-w-full rounded-xl border border-border/60 bg-background/60 px-4 py-3 shadow-sm">
        <p className="line-clamp-2 text-sm font-medium">{title}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Preview pending</p>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
