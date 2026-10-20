"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandLoader } from "@/components/brand-loader";
import {
  ComponentCard,
  type MarketplaceCardItem,
} from "@/components/marketplace/component-card";
import { normalizeGroup } from "@/lib/categories";

/** A row a grid can paint. The feed's own item type widened this to nothing. */
export type ComponentGridItem = MarketplaceCardItem;

export type GridFilters = {
  /** The selected chip, or "all". */
  category: string;
  setCategory: (next: string) => void;
  /** What the chips can offer, "all" included. */
  categories: string[];
  /** Everything the group scope and the chips let through. */
  visible: ComponentGridItem[];
  /** True while something is narrowing the grid down. */
  isFiltering: boolean;
  /** Back to every row, in one step. */
  clear: () => void;
};

/**
 * The category scope, in one place.
 *
 * The grid used to own a search box and a sort as well, and both moved into
 * the ⌘K palette: the palette is mounted by the shell, so the search and the
 * sort are the same control on every page, and the feed's toolbar carries the
 * count instead of two widgets. What is left here is the one filter the grid
 * owns — the category — because the chips are drawn from the rows on screen
 * and have to be next to them.
 *
 * The feed's filter box lives in the shell's fixed toolbar, which is a
 * different part of the tree from the cards it filters, so the state has to be
 * lifted above both. It is lifted here rather than into the feed's own
 * `useState` calls so that a page with nowhere to put a toolbar gets exactly
 * the same behaviour from `<ComponentGrid>` alone: the hook is the whole
 * implementation, and the grid calls it for itself when nobody hands one down.
 *
 * The failure this exists to avoid is a search box that filters a list it no
 * longer owns. Two copies of this state type-check fine, work at first, and
 * then quietly stop agreeing the first time either is read on the server.
 */
export function useGridFilters({
  items,
  group,
  defaultCategory = "all",
  onCategoryChange,
}: {
  items: ComponentGridItem[];
  /** Restricts the grid to one taxonomy group before any filter runs. */
  group?: string;
  /** The category to start on, re-read whenever it changes. */
  defaultCategory?: string;
  /** Told about every chip press, so a parent can put it in the URL. */
  onCategoryChange?: (next: string) => void;
}): GridFilters {
  const [category, setCategoryState] = useState(defaultCategory);

  // The rail's category links navigate to /?category=… — keep the chip state
  // reading from the URL so deep links and rail clicks stay in sync.
  useEffect(() => {
    setCategoryState(defaultCategory);
  }, [defaultCategory]);

  const setCategory = useCallback(
    (next: string) => {
      setCategoryState(next);
      onCategoryChange?.(next);
    },
    [onCategoryChange]
  );

  // The group is a scope, not a chip: it decides what this grid is for before
  // any filter runs, so the chips below it are derived from what is left. A
  // chips row counting rows the group already excluded is the same "the header
  // says twelve and the grid shows four" bug the taxonomy was written to kill.
  const scoped = useMemo(() => {
    if (!group) return items;
    const wanted = normalizeGroup(group);
    return items.filter((item) => normalizeGroup(item.category) === wanted);
  }, [items, group]);

  // Categories are derived from the live rows so the chips never lie: a chip
  // nothing can satisfy is a chip that only ever empties the grid.
  const categories = useMemo(() => {
    const keys = new Set<string>();
    for (const item of scoped) {
      const value = item.category?.trim().toLowerCase();
      if (value) keys.add(value);
    }
    return ["all", ...Array.from(keys).sort()];
  }, [scoped]);

  const visible = useMemo(() => {
    if (category === "all") return scoped;
    /* Both sides of the comparison go through the taxonomy. The rail now
       links the canonical groups, so `?category=marketing` has to mean
       "everything filed as a marketing block" — a component stored as
       `hero` or `block` included. Raw string equality said otherwise, and the
       result was a header that counted twelve and a grid that showed
       four. normalizeGroup is idempotent and total, so the raw chip
       values below still resolve to the bucket they always did. */
    return scoped.filter((item) => {
      const sameGroup =
        normalizeGroup(item.category) === normalizeGroup(category);
      const taggedAsCategory = item.tags.some(
        (tag) => tag.toLowerCase() === category
      );
      return sameGroup || taggedAsCategory;
    });
  }, [scoped, category]);

  const clear = useCallback(() => {
    setCategory("all");
  }, [setCategory]);

  return {
    category,
    setCategory,
    categories,
    visible,
    isFiltering: category !== "all",
    clear,
  };
}

/**
 * The grid's columns.
 *
 * Two rules, and both of them are about the card rather than the window.
 *
 * The column count follows the *container*, not the viewport: the feed paints
 * these cards across a whole shell panel and a profile paints the same cards
 * in the narrow column beside the author's bio, and a grid that counted the
 * window gave the same component a different size on each surface.
 *
 * The track is capped at `22.5rem`. A `1fr` track is always exactly as wide as
 * the space it is given, so with two containers of different widths the same
 * card came out two sizes — 1fr cannot be equal in two boxes that are not
 * equal, and the two boxes here are 1134px and 814px wide. Capping the track
 * makes the card one size in both, and leaves the container to decide how many
 * of them fit. `minmax(0, …)` keeps a narrow container from overflowing: below
 * the width a card needs, it shrinks rather than spilling out of its column.
 */
const GRID_CLASSES =
  "grid grid-cols-1 gap-5 @[520px]:grid-cols-[repeat(2,minmax(0,22.5rem))] @[900px]:grid-cols-[repeat(3,minmax(0,22.5rem))] @[1200px]:grid-cols-[repeat(4,minmax(0,22.5rem))]";

/**
 * The searchable, sortable, category-filtered card grid.
 *
 * The feed had all of this inline in one component that was otherwise about
 * fetching, ⌘K and the detail dialog — so the second page that needed a grid
 * had no way to have one, and a creator's library was a wall of cards with no
 * way to narrow it. This is that grid, lifted out whole: the same search box,
 * chips, sort control, skeleton and empty state, and the same card, because a
 * card grid that changed its card between pages would read as two products.
 *
 * Hand it `filters` when the controls have to live somewhere else — the feed
 * puts them in the shell's fixed toolbar, above the scroll container — and it
 * renders its own row above the cards when nobody does.
 */
export function ComponentGrid({
  items,
  filters,
  loading = false,
  failed = false,
  group,
  chips = "always",
  empty,
  onSave,
  onLike,
  savedSlugs,
  likedSlugs,
  onOpen,
}: {
  /** Everything the grid may show. Filtering happens here, not on the server. */
  items: ComponentGridItem[];
  /** A lifted `useGridFilters`, when the controls are placed by a parent. */
  filters?: GridFilters;
  /** Paints the skeleton instead of the cards. */
  loading?: boolean;
  /** The page's own fetch failed, which is a different message from "no rows". */
  failed?: boolean;
  /**
   * Restricts the grid to one taxonomy group, so a creator's "Components" tab
   * can be the same grid as their "Blocks" tab with a different argument.
   * Keyed on `normalizeGroup`, because the stored category is whatever the
   * author picked out of an ad-hoc list: `hero` and `block` are both blocks,
   * and a tab reading the raw string would show an empty grid under a badge
   * counting four.
   */
  group?: string;
  /**
   * Where the category chips may render. "rail" keeps them to phones, where
   * the rail is behind a drawer and the chips are the only filter on screen;
   * "always" is for a page with no rail catalog of its own.
   */
  chips?: "rail" | "always";
  /** Replaces the built-in empty state — a profile has its own copy. */
  empty?: ReactNode;
  onSave?: (slug: string) => void;
  onLike?: (slug: string) => void;
  savedSlugs?: Record<string, boolean>;
  likedSlugs?: Record<string, boolean>;
  /** Opens the detail dialog. Without it the card links straight to the page. */
  onOpen?: (slug: string) => void;
}) {
  // Unconditional, so the hook order never depends on whether a parent lifted
  // the filters. When one is handed down this instance's own copy is simply
  // unused — the price is one extra pass over the rows, not a second source
  // of truth.
  const own = useGridFilters({
    items,
    group,
    defaultCategory: filters?.category ?? "all",
  });
  const state = filters ?? own;

  return (
    /* The grid measures its container, not the window.
     *
     * The feed paints these cards across a whole shell panel; a profile
     * paints the same cards in the narrow column beside the author's bio.
     * Asking the viewport for the column count meant the same component was
     * one size on the feed and another on the profile — the same shelf with
     * two different boxes on it. `@container` makes the grid ask the box it
     * is in: the feed's panel and the profile's column each get the columns
     * that fit *them*, and the card is the same size on both. */
    <div className="@container">
      {/* The count and the categories, on one line: they are the same
          question — "what is in here" — and two rows of pills above a grid of
          pictures is two rows too many. */}
      <div
        className={cn(
          "mb-4 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          chips === "rail" && "md:hidden"
        )}
      >
        {!filters ? (
          <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
            {loading
              ? "Loading…"
              : `${state.visible.length} component${
                  state.visible.length === 1 ? "" : "s"
                }`}
          </span>
        ) : null}
        {state.categories.map((cat) => (
          <button
            key={cat}
            type="button"
            aria-pressed={state.category === cat}
            onClick={() => state.setCategory(cat)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs capitalize transition",
              state.category === cat
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        state.visible.length ? (
          /* The cards are already on the page and something is being refetched
             in the background: the shape of the grid is worth keeping, so the
             page does not jump when the answer arrives. */
          <div
            className={GRID_CLASSES}
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
        ) : (
          /* Nothing on the page yet: this is the wait, and it should look
             like the site rather than like a broken layout. */
          <BrandLoader className="min-h-[320px] rounded-xl" />
        )
      ) : state.visible.length ? (
        <div className={GRID_CLASSES}>
          {state.visible.map((item) => (
            <ComponentCard
              key={item.slug}
              item={item}
              onOpen={onOpen}
              onSave={onSave}
              onLike={onLike}
              savedSlugs={savedSlugs}
              likedSlugs={likedSlugs}
            />
          ))}
        </div>
      ) : failed || state.isFiltering ? (
        /* Narrowed to nothing, or a feed that could not be fetched. Both mean
           "try again" rather than "there is nothing here" — which is why they
           are checked before the page's own empty state: telling a creator who
           just typed a search that they have never published anything would be
           a worse lie than an empty grid. */
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <p className="text-sm font-medium">
            {failed
              ? "The feed is unavailable right now"
              : "No components match your filters"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {failed
              ? "Please refresh in a moment."
              : "Try another category, or search with ⌘K."}
          </p>
          {state.isFiltering && !failed ? (
            <Button variant="outline" className="mt-4" onClick={state.clear}>
              Clear filters
            </Button>
          ) : (
            <Button className="mt-4" asChild>
              <Link href="/studio">Open studio</Link>
            </Button>
          )}
        </div>
      ) : empty !== undefined ? (
        empty
      ) : (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <p className="text-sm font-medium">No components yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Be the first to publish one from the studio.
          </p>
          <Button className="mt-4" asChild>
            <Link href="/studio">Open studio</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
