"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";
import { RelativeTime } from "@/components/marketplace/relative-time";
import { coverImageUrl, previewVideoUrl } from "@/lib/images";

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

/**
 * 21st-style marketplace card.
 *
 * The cover is the author's uploaded thumbnail; hovering swaps in the uploaded
 * video, and the video src is only assigned on hover so a page of thirty
 * cards streams nothing until it is actually under the cursor. Install
 * commands and metrics stay off the card face — the card is a catalogue
 * image; the detail page is where evaluation happens.
 */
export function ComponentCard({
  item,
  onSave,
  onLike,
  savedSlugs,
  likedSlugs,
  onOpen,
  hideAuthor = false,
}: {
  item: MarketplaceCardItem;
  onSave?: (slug: string) => void;
  onLike?: (slug: string) => void;
  savedSlugs?: Record<string, boolean>;
  likedSlugs?: Record<string, boolean>;
  /** Opens the detail dialog. When absent the card links straight to the page. */
  onOpen?: (slug: string) => void;
  /**
   * Drops the author name, leaving the title and its age.
   *
   * Opt-in and defaulting off, because everywhere else on the site the author
   * is the one piece of the card you have not already read: the page heading,
   * the rail, the search result. On a creator's own library it is a line of
   * forty repetitions of the name directly above the grid, and the link it
   * wraps points back at the page it is already on.
   */
  hideAuthor?: boolean;
}) {
  /** The video src is assigned only on hover — nothing fetches otherwise. */
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const [coverLoaded, setCoverLoaded] = useState(false);
  const [optimisticLike, setOptimisticLike] = useState(false);
  const coverRef = useRef<HTMLImageElement | null>(null);

  const saved = Boolean(savedSlugs?.[item.slug]);
  const liked = Boolean(likedSlugs?.[item.slug]) || optimisticLike;

  // Ask the CDN for the size the card paints rather than the size the author
  // uploaded. The originals are still full-resolution renders; at card scale
  // they are tens of times the bytes for pixels nobody sees.
  const coverSrc = coverImageUrl(item.thumbnailUrl);
  const videoSrc = previewVideoUrl(item.videoUrl);
  const hasCover = Boolean(coverSrc) && !coverFailed;

  /**
   * A cached cover can finish before React attaches `onLoad`, and then the
   * event never fires — the image stays at the opacity this frame gave it and
   * the card is permanently blank. `complete` is the only way to ask after the
   * fact, so the effect covers the hydration case and `onLoad` covers the rest.
   */
  useEffect(() => {
    setCoverLoaded(false);
    setCoverFailed(false);
    if (coverRef.current?.complete && coverRef.current.naturalWidth > 0) {
      setCoverLoaded(true);
    }
  }, [coverSrc]);

  const cover = (
    <>
      {videoLoaded && videoSrc ? (
        <video
          src={videoSrc}
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
        />
      ) : hasCover ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={coverRef}
            src={coverSrc}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            onLoad={() => setCoverLoaded(true)}
            onError={() => setCoverFailed(true)}
            className={cn(
              "h-full w-full object-cover transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.2,0,0,1)] group-hover:scale-[1.03]",
              coverLoaded ? "opacity-100" : "opacity-0"
            )}
          />
          {coverLoaded ? null : <CoverSkeleton />}
        </>
      ) : (
        <FallbackPreview
          title={item.title}
          tags={item.tags}
          category={item.category}
        />
      )}
    </>
  );

  function handleLike() {
    setOptimisticLike((v) => !v);
    onLike?.(item.slug);
  }

  return (
    <article className="group relative flex flex-col">
      {/* Cover — the video only mounts while the pointer is over the card,
          exactly like a card catalogue that never streams off-screen. */}
      <div
        className="relative aspect-[16/10] overflow-hidden rounded-lg border border-border/40 bg-background transition-[border-color,box-shadow] duration-300 ease-[cubic-bezier(0.2,0,0,1)] group-hover:border-foreground/15 group-hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.35)]"
        onMouseEnter={() => item.videoUrl && setVideoLoaded(true)}
        onMouseLeave={() => setVideoLoaded(false)}
        onTouchStart={() => item.videoUrl && setVideoLoaded(true)}
        onTouchEnd={() => setVideoLoaded(false)}
      >
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
        <div className="absolute right-2 bottom-2 z-20 flex translate-y-1 gap-1 opacity-0 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
          {onSave ? (
            <button
              type="button"
              title={saved ? "Remove from saved" : "Save for later"}
              aria-label={saved ? "Remove from saved" : "Save for later"}
              aria-pressed={saved}
              onClick={() => onSave(item.slug)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-background/85 text-foreground/70 backdrop-blur-sm transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.96]"
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
                "flex h-7 w-7 items-center justify-center rounded-full bg-background/85 backdrop-blur-sm transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.96]",
                liked ? "text-rose-500" : "text-foreground/70 hover:text-foreground"
              )}
            >
              <HeartIcon
                className={cn("h-3.5 w-3.5", liked && "fill-current")}
                aria-hidden="true"
              />
            </button>
          ) : null}
        </div>
      </div>

      {/* Meta */}
      <div className="mt-2.5 flex items-start gap-2.5">
        {hideAuthor ? null : (
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
        )}

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
            {hideAuthor ? null : (
              <>
                <Link
                  href={`/u/${item.author.username}`}
                  className="truncate rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.author.name}
                </Link>
                {/* The dot belongs to the pair: with no name in front of it, a
                    leading separator is the first thing on the line. */}
                {item.createdAt ? (
                  <span aria-hidden="true" className="text-border">
                    ·
                  </span>
                ) : null}
              </>
            )}
            {item.createdAt ? (
              <RelativeTime value={item.createdAt} className="shrink-0" />
            ) : null}
          </div>
        </div>
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

/**
 * What the cover shows until the author's image has decoded.
 *
 * A card whose cover has not arrived is the most common thing on a cold feed,
 * and an empty grey rectangle reads as "nothing here" rather than "almost
 * here". The mark, pulsing once per second at the size of a favicon, is enough
 * to say the surface is loading — and it is the only branded thing on the card,
 * so it has to be quiet.
 */
function CoverSkeleton() {
  return (
    <span
      className="absolute inset-0 flex items-center justify-center bg-muted/25"
      aria-hidden="true"
    >
      <span className="animate-pulse">
        <BrandMark size={22} glow={false} />
      </span>
    </span>
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
