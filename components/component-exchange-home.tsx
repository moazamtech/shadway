"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ComponentGrid,
  GridSearchInput,
  GridSortSelect,
  useGridFilters,
  type ComponentGridItem,
} from "@/components/marketplace/component-grid";
import { CommandPalette } from "@/components/marketplace/command-palette";
import { AppShell } from "@/components/marketplace/app-shell";
import { ComponentDetailDialog } from "@/components/marketplace/component-detail-dialog";
import { FEED_LIMIT } from "@/lib/feed";

export function ComponentExchangeHome({
  initialItems,
}: {
  /** The first page of the feed, already rendered on the server. */
  initialItems?: ComponentGridItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category") ?? "all";

  const [items, setItems] = useState<ComponentGridItem[]>(initialItems ?? []);
  const [loading, setLoading] = useState(!initialItems?.length);
  const [failed, setFailed] = useState(false);
  const [savedSlugs, setSavedSlugs] = useState<Record<string, boolean>>({});
  const [likedSlugs, setLikedSlugs] = useState<Record<string, boolean>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  // The grid's filters live here, not inside `<ComponentGrid>`, because half
  // of their controls have to sit in the shell's fixed toolbar — a different
  // part of the tree from the cards they filter. The rail reads the selected
  // group from the same value, which is how the rail's highlight and the
  // chips stay on the same category without either one owning it.
  const filters = useGridFilters({
    items,
    defaultCategory: categoryParam,
    onCategoryChange: (next) => {
      router.replace(next === "all" ? "/" : `/?category=${next}`, {
        scroll: false,
      });
    },
  });

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

  const count = filters.visible.length;

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
        activeCategory={filters.category}
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
                  : `${count} component${count === 1 ? "" : "s"}`}
              </span>

              <GridSearchInput
                query={filters.query}
                onQueryChange={filters.setQuery}
                clearQuery={() => filters.setQuery("")}
              />

              <GridSortSelect
                sort={filters.sort}
                onSortChange={filters.setSort}
              />
            </div>
          </>
        }
      >
        <div className="px-3 py-4 lg:px-5 lg:py-5">
          <ComponentGrid
            items={items}
            filters={filters}
            loading={loading}
            failed={failed}
            chips="rail"
            onSave={toggleSave}
            onLike={toggleLike}
            savedSlugs={savedSlugs}
            likedSlugs={likedSlugs}
            onOpen={setOpenSlug}
          />
        </div>
      </AppShell>
    </>
  );
}
