"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Clock,
  Command,
  Download,
  Eye,
  Flame,
  Layers,
  Library,
  Package,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ComponentCard,
  type MarketplaceCardItem,
} from "@/components/marketplace/component-card";
import { UserMenu } from "@/components/user-menu";
import { CommandPalette } from "@/components/marketplace/command-palette";
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
  { id: "views", label: "Most viewed", icon: Eye },
] as const;

type SortId = (typeof SORTS)[number]["id"];

const FEED_LIMIT = 48;

function sortItems(items: FeedItem[], sort: SortId): FeedItem[] {
  const copy = [...items];
  switch (sort) {
    case "popular":
      return copy.sort(
        (a, b) => b.likes - a.likes || b.installs - a.installs
      );
    case "installs":
      return copy.sort((a, b) => b.installs - a.installs);
    case "views":
      return copy.sort((a, b) => b.views - a.views);
    case "newest":
    default:
      return copy.sort((a, b) => {
        const at = a.createdAt ? Date.parse(a.createdAt) : 0;
        const bt = b.createdAt ? Date.parse(b.createdAt) : 0;
        return bt - at;
      });
  }
}

export function ComponentExchangeHome() {
  const router = useRouter();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortId>("newest");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [savedSlugs, setSavedSlugs] = useState<Record<string, boolean>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);

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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFailed(false);
      try {
        const res = await fetch(`/api/components?sort=latest&limit=${FEED_LIMIT}`, {
          cache: "no-store",
        });
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

  // Restore saved components for signed-in users.
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
        const itemCategory = item.category?.trim().toLowerCase();
        const taggedAsCategory = item.tags.some(
          (tag) => tag.toLowerCase() === category
        );
        if (itemCategory !== category && !taggedAsCategory) return false;
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

  const toggleSave = useCallback(async (slug: string) => {
    const wasSaved = Boolean(savedSlugs[slug]);
    setSavedSlugs((prev) => ({ ...prev, [slug]: !wasSaved }));

    try {
      const res = await fetch("/api/components/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, action: wasSaved ? "remove" : "save" }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setSavedSlugs((prev) => ({ ...prev, [slug]: wasSaved }));
    }
  }, [savedSlugs]);

  const isFiltering = debouncedQuery.trim().length > 0 || category !== "all";

  const handlePaletteSelect = useCallback(
    (slug: string) => {
      setPaletteOpen(false);
      router.push(`/c/${slug}`);
    },
    [router]
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={handlePaletteSelect}
      />

      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3 lg:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 bg-muted/40">
              <Layers className="h-4 w-4" />
            </span>
            <span className="font-serif text-sm font-semibold tracking-tight">
              Shadway
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link
              href="/collections"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Library className="h-4 w-4" />
              Collections
            </Link>
            <Link
              href="/bundles"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Package className="h-4 w-4" />
              Bundles
            </Link>
          </nav>

          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search components, tags, authors..."
              aria-label="Search components"
              className="h-9 w-full rounded-lg border border-border/70 bg-background pl-9 pr-12 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
              title="Search (⌘K)"
              className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:bg-muted"
            >
              <Command className="h-3 w-3" />
              K
            </button>
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-14 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/studio">
              <Sparkles className="mr-1.5 h-4 w-4" />
              Open studio
            </Link>
          </Button>
          <UserMenu />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 lg:px-6">
        {/* Sidebar — category nav with counts. */}
        <aside className="hidden w-52 shrink-0 lg:block">
          <div className="sticky top-20 space-y-6">
            <nav className="space-y-0.5" aria-label="Feed filters">
              {SORTS.map((s) => {
                const Icon = s.icon;
                const active = sort === s.id && !isFiltering;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSort(s.id);
                      setCategory("all");
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                      active
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {s.label}
                  </button>
                );
              })}
            </nav>

            <div>
              <h2 className="mb-2 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Categories
              </h2>
              <nav className="space-y-0.5" aria-label="Categories">
                {categories.list.map((cat) => {
                  const active = category === cat;
                  const count =
                    cat === "all"
                      ? items.length
                      : (categories.counts[cat] ?? 0);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm capitalize transition",
                        active
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      <span className="truncate">{cat}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </aside>

        {/* Main column. */}
        <div className="min-w-0 flex-1">
          {/* Mobile category chips (sidebar is hidden below lg). */}
          <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 lg:hidden">
            {categories.list.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs capitalize transition",
                  category === cat
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-xs tabular-nums text-muted-foreground">
              {loading
                ? "Loading…"
                : `${filtered.length} component${filtered.length === 1 ? "" : "s"}`}
            </span>
            <label className="relative flex items-center">
              <ArrowUpDown className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortId)}
                aria-label="Sort components"
                className="h-8 appearance-none rounded-full border border-border/70 bg-background pl-7 pr-3 text-xs outline-none transition focus:border-primary/60"
              >
                {SORTS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <div
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
              aria-busy="true"
              aria-label="Loading components"
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-xl border border-border/70"
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
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item) => (
                <ComponentCard
                  key={item.slug}
                  item={item}
                  onSave={toggleSave}
                  savedSlugs={savedSlugs}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 p-16 text-center">
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
                    setCategory("all");
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
      </div>
    </main>
  );
}
