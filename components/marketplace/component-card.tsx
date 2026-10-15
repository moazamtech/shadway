"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, Check, Copy, Download, Play } from "lucide-react";
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
 *
 * Uses the cover image captured at publish time so the feed never boots a
 * bundler per card. Hovering a video plays it inline.
 *
 * Deliberately carries no view or like counts on its face: the feed is a
 * catalogue, and a number under every thumbnail trains visitors to scroll past
 * anything that has not been liked yet. Installs stay, styled as a quiet
 * secondary detail, because they are the one signal that says a component is
 * actually used.
 */
export function ComponentCard({
  item,
  onSave,
  onLike,
  savedSlugs,
  likedSlugs,
  onOpen,
}: {
  item: MarketplaceCardItem;
  onSave?: (slug: string) => void;
  onLike?: (slug: string) => void;
  savedSlugs?: Record<string, boolean>;
  likedSlugs?: Record<string, boolean>;
  /** Opens the detail dialog. When absent the card links straight to the page. */
  onOpen?: (slug: string) => void;
}) {
  const [showVideo, setShowVideo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const [optimisticLike, setOptimisticLike] = useState(false);

  const saved = Boolean(savedSlugs?.[item.slug]);
  const liked = Boolean(likedSlugs?.[item.slug]) || optimisticLike;
  const hasCover = Boolean(item.thumbnailUrl) && !coverFailed;

  async function copyInstall() {
    try {
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://shadway.online";
      await navigator.clipboard.writeText(
        `npx shadcn@latest add ${origin}/r/${item.slug}`
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  function handleLike() {
    setOptimisticLike((v) => !v);
    onLike?.(item.slug);
  }

  const cover = (
    <>
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
          className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.03]"
        />
      ) : (
        <FallbackPreview
          title={item.title}
          tags={item.tags}
          category={item.category}
        />
      )}
    </>
  );

  return (
    <article className="group relative flex flex-col">
      {/* Cover */}
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-border/40 bg-background transition-all duration-300 group-hover:border-foreground/15 group-hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.35)]">
        {onOpen ? (
          <>
            {cover}
            <button
              type="button"
              onClick={() => onOpen(item.slug)}
              aria-label={`Open ${item.title}`}
              className="absolute inset-0 z-10 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </>
        ) : (
          <Link
            href={`/c/${item.slug}`}
            aria-label={`View ${item.title}`}
            className="absolute inset-0 z-10 block outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {cover}
          </Link>
        )}

        {/* Category badge */}
        {item.category ? (
          <span className="absolute top-2 left-2 z-20 rounded-full border border-border/30 bg-background/70 px-2 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-foreground/70 uppercase backdrop-blur-sm">
            {item.category}
          </span>
        ) : null}

        {/* Video indicator */}
        {item.videoUrl ? (
          <span className="absolute top-2 right-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-background/70 text-foreground/70 backdrop-blur-sm">
            <Play className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
          </span>
        ) : null}

        {/* Hover actions */}
        <div className="absolute right-2 bottom-2 z-20 flex translate-y-1 gap-1 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
          {onSave ? (
            <button
              type="button"
              title={saved ? "Remove from saved" : "Save for later"}
              aria-label={saved ? "Remove from saved" : "Save for later"}
              aria-pressed={saved}
              onClick={() => onSave(item.slug)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-background/85 text-foreground/70 backdrop-blur-sm transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Bookmark
                className={cn("h-3.5 w-3.5", saved && "fill-current")}
                aria-hidden="true"
              />
            </button>
          ) : null}
          {onLike ? (
            <button
              type="button"
              title={liked ? "Unlike" : "Like"}
              aria-label={liked ? "Unlike this component" : "Like this component"}
              aria-pressed={liked}
              onClick={handleLike}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full bg-background/85 backdrop-blur-sm transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                liked ? "text-rose-500" : "text-foreground/70 hover:text-foreground"
              )}
            >
              <HeartIcon
                className={cn("h-3.5 w-3.5", liked && "fill-current")}
                aria-hidden="true"
              />
            </button>
          ) : null}
          <button
            type="button"
            title={copied ? "Copied" : "Copy install command"}
            aria-label={copied ? "Install command copied" : "Copy install command"}
            onClick={() => void copyInstall()}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-background/85 text-foreground/70 backdrop-blur-sm transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="mt-2.5 flex items-start gap-2.5">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/40 bg-muted/50 text-[9px] font-bold uppercase text-muted-foreground"
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
          {onOpen ? (
            <button
              type="button"
              onClick={() => onOpen(item.slug)}
              className="block truncate rounded-sm text-left text-[13px] leading-tight font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.title}
            </button>
          ) : (
            <Link
              href={`/c/${item.slug}`}
              className="block truncate rounded-sm text-[13px] leading-tight font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.title}
            </Link>
          )}
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Link
              href={`/u/${item.author.username}`}
              className="truncate rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.author.name}
            </Link>
            {item.createdAt ? (
              <>
                <span aria-hidden="true" className="text-border">
                  ·
                </span>
                <span className="shrink-0">{timeAgo(item.createdAt)}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Installs — the only metric on the card face. */}
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Download className="h-3 w-3" aria-hidden="true" />
        <span className="tabular-nums">{item.installs}</span>
        <span>installs</span>
      </div>
    </article>
  );
}

/** Inline heart so the icon set stays small. */
function HeartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
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
  const monogram = (category || tags[0] || title)
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2.5 bg-gradient-to-br from-muted/40 via-background to-muted/20 p-4 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/40 bg-background/60 text-xs font-semibold tracking-widest text-muted-foreground">
        {monogram}
      </span>
      <p className="line-clamp-2 text-xs font-medium text-muted-foreground">{title}</p>
    </div>
  );
}
