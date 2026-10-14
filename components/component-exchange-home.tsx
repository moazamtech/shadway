"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, Copy, Eye, Layers, Play, Search, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type FeedItem = {
  slug: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  title: string;
  description: string;
  author: { name: string; username: string; avatar?: string };
  tags: string[];
  dependencies: string[];
  installs: number;
  views: number;
  likes: number;
};

const CATEGORIES = ["all", "ui", "block", "marketing", "animation", "form", "data"];

export function ComponentExchangeHome() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [hoverVideo, setHoverVideo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/components?sort=latest&limit=48", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("feed unavailable");
        const data = await res.json();
        if (!cancelled && Array.isArray(data.items)) {
          setItems(
            data.items.map(
              (item: {
                slug: string;
                thumbnailUrl?: string;
                videoUrl?: string;
                title: string;
                description: string;
                author: FeedItem["author"];
                tags?: string[];
                dependencies?: string[];
                installs?: number;
                views?: number;
                likes?: number;
              }) => ({
                slug: item.slug,
                thumbnailUrl: item.thumbnailUrl,
                videoUrl: item.videoUrl,
                title: item.title,
                description: item.description,
                author: item.author,
                tags: item.tags || [],
                dependencies: item.dependencies || [],
                installs: item.installs || 0,
                views: item.views || 0,
                likes: item.likes || 0,
              })
            )
          );
        }
      } catch {
        // Keep the empty state if the feed is unavailable.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "all" && item.tags.indexOf(category) === -1) {
        const matchesCategory = (item as FeedItem & { category?: string }).category === category;
        if (!matchesCategory) return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        item.author.username.toLowerCase().includes(q)
      );
    });
  }, [items, query, category]);

  async function copyInstall(slug: string) {
    try {
      await navigator.clipboard.writeText(
        `npx shadcn@latest add https://shadway.com/r/${slug}`
      );
      setCopiedSlug(slug);
      window.setTimeout(() => setCopiedSlug((c) => (c === slug ? null : c)), 1600);
    } catch {}
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 lg:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            <span className="text-sm font-semibold tracking-tight">Shadway</span>
          </Link>

          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search components, tags, authors..."
              aria-label="Search components"
              className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary"
            />
          </div>

          <Button asChild className="hidden sm:inline-flex">
            <Link href="/studio">Open studio</Link>
          </Button>
          <Button variant="outline" asChild className="hidden sm:inline-flex">
            <Link href="/new">Quick paste</Link>
          </Button>
        </div>

        <div className="mx-auto flex max-w-[1500px] items-center gap-2 overflow-x-auto px-4 pb-3 lg:px-6">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs capitalize transition ${
                category === item
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {item}
            </button>
          ))}
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {loading ? "Loading..." : `${filtered.length} components`}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-6 lg:px-6">
        {filtered.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((item) => {
              const showVideo = Boolean(item.videoUrl) && hoverVideo === item.slug;
              return (
                <article key={item.slug} className="group">
                  <Link
                    href={`/c/${item.slug}`}
                    className="block"
                    onMouseEnter={() => setHoverVideo(item.slug)}
                    onMouseLeave={() => setHoverVideo(null)}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted/40">
                      {showVideo ? (
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
                        <StaticCardFallback title={item.title} tags={item.tags} />
                      )}

                      {item.videoUrl && (
                        <span className="absolute left-2 top-2 rounded-md bg-background/90 px-2 py-1 backdrop-blur">
                          <Video className="h-3.5 w-3.5" />
                        </span>
                      )}

                      <span className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                        <span
                          role="button"
                          tabIndex={0}
                          title="Copy install command"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void copyInstall(item.slug);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void copyInstall(item.slug);
                          }}
                          className="rounded-md bg-background/90 p-1.5 backdrop-blur"
                        >
                          {copiedSlug === item.slug ? (
                            <span className="text-[10px] font-medium">OK</span>
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </span>
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-[11px] font-semibold">
                        {item.author.username.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-medium">{item.title}</h3>
                        <p className="truncate text-xs text-muted-foreground">
                          @{item.author.username}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                        {item.views > 0 && (
                          <span className="flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            {item.views}
                          </span>
                        )}
                        {item.likes > 0 && (
                          <span className="flex items-center gap-1">
                            <Bookmark className="h-3.5 w-3.5" />
                            {item.likes}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-16 text-center">
            <Play className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              {loading ? "Loading components..." : "No components yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Be the first to publish one from the studio.
            </p>
            <Button className="mt-4" asChild>
              <Link href="/studio">Open studio</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

function StaticCardFallback({ title, tags }: { title: string; tags: string[] }) {
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