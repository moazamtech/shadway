"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ComponentGrid,
  useGridFilters,
  type ComponentGridItem,
} from "@/components/marketplace/component-grid";
import { usePalette } from "@/components/marketplace/palette-context";
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

  // ⌘K / Ctrl+K opens the command palette, and the shell owns it — the
  // shortcut works on every page, not only here.
  const palette = usePalette();

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

  const openPalette = useCallback(() => palette.open(), [palette]);

  const activeItem = useMemo(
    () => items.find((item) => item.slug === openSlug) ?? null,
    [items, openSlug]
  );

  /**
   * Page through the grid while the showcase is open.
   *
   * The dialog is a stage, and a stage you can only leave is a dead end: the
   * reader has just been looking at a component and the next one is right
   * there. The step is taken over the *visible* list — the same order the
   * grid is drawn in — and the ends wrap around, because a component gallery
   * that stops at the last card is a gallery with a wall in it.
   */
  const step = useCallback(
    (delta: number) => {
      if (!items.length) return;
      const index = items.findIndex((item) => item.slug === openSlug);
      const from = index === -1 ? 0 : index;
      const next = (from + delta + items.length) % items.length;
      setOpenSlug(items[next].slug);
    },
    [items, openSlug]
  );

  const count = filters.visible.length;

  return (
    <>
      <ComponentDetailDialog
        item={activeItem}
        open={Boolean(openSlug)}
        onOpenChange={(next) => {
          if (!next) setOpenSlug(null);
        }}
        saved={activeItem ? Boolean(savedSlugs[activeItem.slug]) : false}
        liked={activeItem ? Boolean(likedSlugs[activeItem.slug]) : false}
        onToggleSave={toggleSave}
        onToggleLike={toggleLike}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
      />

      {/* The shell: a rail on the tinted canvas, and the feed living in a
          raised surface panel beside it. The toolbar rides the panel's first
          row; the shell owns the scroll container. */}
      <AppShell
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
              <Button
                variant="outline"
                size="sm"
                onClick={openPalette}
                className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-medium tabular-nums text-muted-foreground transition-colors hover:text-foreground"
              >
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                {loading ? "—" : count}
                <span className="hidden sm:inline">
                  {count === 1 ? "component" : "components"}
                </span>
              </Button>
            </div>
          </>
        }
      >
        <div className="px-3 py-4 lg:px-4 lg:py-5">
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
