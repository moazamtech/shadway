"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpDown,
  Clock,
  Download,
  Flame,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ComponentCard,
  type MarketplaceCardItem,
} from "@/components/marketplace/component-card";
import { CommandPalette } from "@/components/marketplace/command-palette";
import { AppShell } from "@/components/marketplace/app-shell";
import { ComponentDetailDialog } from "@/components/marketplace/component-detail-dialog";
import { FEED_LIMIT } from "@/lib/feed";
import { normalizeGroup } from "@/lib/categories";
import { cn } from "@/lib/utils";

/**
 * The feed item adds fields the API returns but the card type does not need.
 * Keeping them local avoids coupling the card to the feed's sort/filter logic.
 */
type FeedItem = MarketplaceCardItem & {
  category?: string;
  createdAt?: string;
};

const SORTS = [
  { id: "newest", label: "Newest", icon: Clock },
  { id: "popular", label: "Popular", icon: Flame },
  { id: "installs", label: "Most installed", icon: Download },
] as const;

type SortId = (typeof SORTS)[number]["id"];

function sortItems(items: FeedItem[], sort: SortId): FeedItem[] {
  const copy = [...items];
  switch (sort) {
    case "popular":
      return copy.sort(
        (a, b) => b.likes - a.likes || b.installs - a.installs
      );
    case "installs":
      return copy.sort((a, b) => b.installs - a.installs);
    case "newest":
    default:
      return copy.sort((a, b) => {
        const at = a.createdAt ? Date.parse(a.createdAt) : 0;
        const bt = b.createdAt ? Date.parse(b.createdAt) : 0;
        return bt - at;
      });
  }
}

export function ComponentExchangeHome({
  initialItems,
}: {
  /** The first page of the feed, already rendered on the server. */
  initialItems?: FeedItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category") ?? "all";

  const [items, setItems] = useState<FeedItem[]>(initialItems ?? []);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState(categoryParam);
  const [sort, setSort] = useState<SortId>("popular");
  const [loading, setLoading] = useState(!initialItems?.length);
  const [failed, setFailed] = useState(false);
  const [savedSlugs, setSavedSlugs] = useState<Record<string, boolean>>({});
  const [likedSlugs, setLikedSlugs] = useState<Record<string, boolean>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  // The rail's category links navigate to /?category=… — keep the feed state
  // reading from the URL so deep links and rail clicks stay in sync.
  useEffect(() => {
    setCategory(categoryParam);
  }, [categoryParam]);

  // Debounce the search box so typing stays smooth on large feeds.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 180);
    return () => clearTimeout(timer);
  }, [query]);

  // ⌘K / Ctrl+K opens the command palette.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Nothing to fetch when the server already rendered the feed: the grid is
  // on screen before this effect runs, and asking for the same page again
  // would only repaint identical cards. The request stays for the case where
  // the server had nothing to hand over — a cold or unreachable database —
  // where the client is the only way to fill the grid.
  const seeded = Boolean(initialItems?.length);

  useEffect(() => {
    if (seeded) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFailed(false);
      try {
        const res = await fetch(
          `/api/components?sort=latest&limit=${FEED_LIMIT}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("feed unavailable");
        const data = await res.json();
        if (!cancelled && Array.isArray(data.items)) setItems(data.items);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore saved and liked components for signed-in users.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/components/bookmarks", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { slugs: [] }))
      .then((data) => {
        if (cancelled) return;
        const map: Record<string, boolean> = {};
        for (const slug of data.slugs ?? []) map[slug] = true;
        setSavedSlugs(map);
      })
      .catch(() => {});

    fetch("/api/me/likes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { slugs: [] }))
      .then((data) => {
        if (cancelled) return;
        const map: Record<string, boolean> = {};
        for (const slug of data.slugs ?? []) map[slug] = true;
        setLikedSlugs(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Categories are derived from the live feed so the chips never lie.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const value = item.category?.trim().toLowerCase();
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return {
      list: ["all", ...Array.from(counts.keys()).sort()],
      counts: Object.fromEntries(counts),
    };
  }, [items]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const matches = items.filter((item) => {
      if (category !== "all") {
        /* Both sides of the comparison go through the taxonomy. The rail now
           links the canonical groups, so `?category=marketing` has to mean
           "everything filed as a marketing block" — a component stored as
           `hero` or `block` included. Raw string equality said otherwise, and
           the result was a header that counted twelve and a grid that showed
           four. normalizeGroup is idempotent and total, so the raw chip
           values below still resolve to the bucket they always did. */
        const sameGroup =
          normalizeGroup(item.category) === normalizeGroup(category);
        const taggedAsCategory = item.tags.some(
          (tag) => tag.toLowerCase() === category
        );
        if (!sameGroup && !taggedAsCategory) return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        item.author.username.toLowerCase().includes(q) ||
        item.author.name.toLowerCase().includes(q)
      );
    });
    return sortItems(matches, sort);
  }, [items, debouncedQuery, category, sort]);

  const toggleSave = useCallback(
    async (slug: string) => {
      const wasSaved = Boolean(savedSlugs[slug]);
      setSavedSlugs((prev) => ({ ...prev, [slug]: !wasSaved }));

      try {
        const res = await fetch("/api/components/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            action: wasSaved ? "remove" : "save",
          }),
        });
        if (!res.ok) throw new Error("failed");
      } catch {
        setSavedSlugs((prev) => ({ ...prev, [slug]: wasSaved }));
      }
    },
    [savedSlugs]
  );

  const toggleLike = useCallback(
    async (slug: string) => {
      const wasLiked = Boolean(likedSlugs[slug]);
      setLikedSlugs((prev) => ({ ...prev, [slug]: !wasLiked }));

      try {
        const res = await fetch(`/api/components/${encodeURIComponent(slug)}/like`, {
          method: wasLiked ? "DELETE" : "POST",
        });
        const data = await res.json().catch(() => ({}));
        if (typeof data.liked === "boolean") {
          setLikedSlugs((prev) => ({ ...prev, [slug]: data.liked }));
        }
      } catch {
        setLikedSlugs((prev) => ({ ...prev, [slug]: wasLiked }));
      }
    },
    [likedSlugs]
  );

  const selectCategory = useCallback(
    (next: string) => {
      setCategory(next);
      router.replace(next === "all" ? "/" : `/?category=${next}`, {
        scroll: false,
      });
    },
    [router]
  );

  const isFiltering = debouncedQuery.trim().length > 0 || category !== "all";

  const handlePaletteSelect = useCallback(
    (slug: string) => {
      setPaletteOpen(false);
      router.push(`/c/${slug}`);
    },
    [router]
  );

  const openPalette = useCallback(() => setPaletteOpen(true), []);

  const activeItem = useMemo(
    () => items.find((item) => item.slug === openSlug) ?? null,
    [items, openSlug]
  );

  return (
    <>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={handlePaletteSelect}
      />

      <ComponentDetailDialog
        item={activeItem}
        open={Boolean(openSlug)}
        onOpenChange={(next) => {
          if (!next) setOpenSlug(null);
        }}
        saved={activeItem ? Boolean(savedSlugs[activeItem.slug]) : false}
        liked={activeItem ? Boolean(likedSlugs[activeItem.slug]) : false}
        likeCount={activeItem?.likes ?? 0}
        onToggleSave={toggleSave}
        onToggleLike={toggleLike}
      />

      {/* The shell: a rail on the tinted canvas, and the feed living in a
          raised surface panel beside it. The toolbar rides the panel's first
          row; the shell owns the scroll container. */}
      <AppShell
        onSearch={openPalette}
        activeCategory={category}
        toolbar={
          <>
            <Button
              variant="outline"
              className="relative h-8 w-full max-w-[320px] justify-start bg-muted/50 pr-12 text-sm font-normal text-muted-foreground shadow-none"
              onClick={openPalette}
              aria-label="Open search"
            >
              <Search className="h-4 w-4" />
              <span className="hidden truncate sm:inline-flex">
                Search components...
              </span>
              <span className="inline-flex truncate sm:hidden">Search...</span>
              <kbd className="pointer-events-none absolute top-1/2 right-[0.3rem] hidden h-5 -translate-y-1/2 items-center gap-1 rounded border bg-muted px-1.5 font-sans text-[11px] select-none sm:flex">
                <span className="text-[11px] font-sans">⌘</span>K
              </kbd>
            </Button>

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-xs tabular-nums text-muted-foreground md:block">
                {loading
                  ? "Loading…"
                  : `${filtered.length} component${filtered.length === 1 ? "" : "s"}`}
              </span>

              <div className="relative hidden sm:block">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter…"
                  aria-label="Search components"
                  className="h-8 w-[170px] rounded-lg border border-border bg-transparent pr-7 pl-8 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring dark:border-input"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <label className="relative flex shrink-0 items-center">
                <ArrowUpDown className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortId)}
                  aria-label="Sort components"
                  className="h-8 appearance-none rounded-lg border border-border bg-transparent pr-2.5 pl-7 text-xs outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring dark:border-input"
                >
                  {SORTS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        }
      >
        <div className="px-3 py-4 lg:px-5 lg:py-5">
          {/* Mobile category chips (the rail is behind the drawer here). */}
          <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 md:hidden">
            {categories.list.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={category === cat}
                onClick={() => selectCategory(cat)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs capitalize transition",
                  category === cat
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading ? (
            <div
              className="grid grid-cols-1 gap-5 min-[520px]:grid-cols-2 min-[900px]:grid-cols-3 min-[1200px]:grid-cols-4"
              aria-busy="true"
              aria-label="Loading components"
            >
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-lg border border-border"
                >
                  <Skeleton className="aspect-[16/10] w-full rounded-none" />
                  <div className="space-y-2 p-3">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length ? (
            <div className="grid grid-cols-1 gap-5 min-[520px]:grid-cols-2 min-[900px]:grid-cols-3 min-[1200px]:grid-cols-4">
              {filtered.map((item) => (
                <ComponentCard
                  key={item.slug}
                  item={item}
                  onSave={toggleSave}
                  onLike={toggleLike}
                  savedSlugs={savedSlugs}
                  likedSlugs={likedSlugs}
                  onOpen={setOpenSlug}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-16 text-center">
              <p className="text-sm font-medium">
                {failed
                  ? "The feed is unavailable right now"
                  : isFiltering
                    ? "No components match your filters"
                    : "No components yet"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {failed
                  ? "Please refresh in a moment."
                  : isFiltering
                    ? "Try a different search term or category."
                    : "Be the first to publish one from the studio."}
              </p>
              {isFiltering && !failed ? (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setQuery("");
                    selectCategory("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button className="mt-4" asChild>
                  <Link href="/studio">Open studio</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </AppShell>
    </>
  );
}
