"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, Copy, Download, Eye, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
};

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
  const saved = savedSlugs?.[item.slug];

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
      className="group"
      onMouseEnter={() => setShowVideo(true)}
      onMouseLeave={() => setShowVideo(false)}
    >
      <div className="block">
        <Link
          href={`/c/${item.slug}`}
          className="relative block aspect-[4/3] overflow-hidden rounded-xl border bg-muted/40"
          aria-label={item.title}
        >
          {showVideo && item.videoUrl ? (
            <video
              src={item.videoUrl}
              className="h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : item.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnailUrl}
              alt={item.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <FallbackPreview title={item.title} tags={item.tags} />
          )}

          {item.videoUrl && (
            <span className="absolute left-2 top-2 rounded-md bg-background/90 px-1.5 py-1 backdrop-blur">
              <Video className="h-3.5 w-3.5" />
            </span>
          )}

          <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition group-hover:opacity-100">
            {onSave && (
              <button
                type="button"
                title={saved ? "Remove from saved" : "Save for later"}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onSave(item.slug);
                }}
                className="rounded-md bg-background/90 p-1.5 backdrop-blur transition hover:bg-background"
              >
                <Bookmark
                  className={`h-3.5 w-3.5 ${saved ? "fill-foreground" : ""}`}
                />
              </button>
            )}
            <button
              type="button"
              title="Copy install command"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void copyInstall();
              }}
              className="rounded-md bg-background/90 px-1.5 py-1.5 text-[10px] font-medium backdrop-blur transition hover:bg-background"
            >
              {copied ? "OK" : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </Link>

        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-[11px] font-semibold">
            {item.author.username.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <Link
              href={`/c/${item.slug}`}
              className="block truncate text-sm font-medium hover:underline"
            >
              {item.title}
            </Link>
            <Link
              href={`/u/${item.author.username}`}
              className="block truncate text-xs text-muted-foreground hover:underline"
            >
              @{item.author.username}
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
            {item.views > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {item.views}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Download className="h-3.5 w-3.5" />
              {item.installs}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function FallbackPreview({ title, tags }: { title: string; tags: string[] }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted to-background p-6 text-center">
      <div className="rounded-xl border bg-background/70 px-4 py-3 shadow-sm">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Preview pending</p>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {tags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="secondary" className="text-[10px]">
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}