"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ComponentCard, type MarketplaceCardItem } from "@/components/marketplace/component-card";
import { RailDivider } from "@/components/marketplace/page-rails";
import { RailCorners } from "@/components/marketplace/rail-corners";
import { findGroup, normalizeGroup } from "@/lib/categories";

/**
 * The homepage, in sections.
 *
 * A catalogue that is one undifferentiated grid answers "what is here" and
 * nothing else. The reader arrives with a question — *what is new*, *what is
 * good*, *what is in the buttons* — and the page should answer it without
 * making them ask. So the feed is laid out the way a shelf is laid out: the
 * newest things at the top, the ones worth showing off next, and then the
 * shelves themselves.
 *
 * Each section is a row that scrolls sideways, because a row of cards is a
 * *strip* of the catalogue: it says "there are more of these" without
 * spending the whole page on them, and a reader who wants the shelf itself
 * opens it from the rail.
 */
export function HomeSections({
  items,
  onOpen,
  onSave,
  onLike,
  savedSlugs,
  likedSlugs,
}: {
  items: MarketplaceCardItem[];
  onOpen: (slug: string) => void;
  onSave?: (slug: string) => void;
  onLike?: (slug: string) => void;
  savedSlugs?: Record<string, boolean>;
  likedSlugs?: Record<string, boolean>;
}) {
  const newest = items.slice(0, 6);

  /**
   * The ones worth showing off.
   *
   * A component its author put in front is the obvious answer, but a
   * catalogue where nobody has done that yet would have no such section at
   * all — and the section is where a reader finds the good stuff. So the
   * most-installed ones stand in until the authors say otherwise.
   */
  const featured = (items.filter((item) => item.featured).length
    ? items.filter((item) => item.featured)
    : [...items].sort((a, b) => b.installs - a.installs)
  ).slice(0, 12);

  const groups = new Map<string, MarketplaceCardItem[]>();
  for (const item of items) {
    const group = normalizeGroup(item.category);
    const bucket = groups.get(group);
    if (bucket) bucket.push(item);
    else groups.set(group, [item]);
  }

  return (
    <div className="space-y-4 pb-8">
      <Section
        title="Newest"
        items={newest}
        onOpen={onOpen}
        onSave={onSave}
        onLike={onLike}
        savedSlugs={savedSlugs}
        likedSlugs={likedSlugs}
      />

      {featured.length ? (
        <>
          <RailDivider />
          <Section
            title="Featured"
            items={featured}
            onOpen={onOpen}
            onSave={onSave}
            onLike={onLike}
            savedSlugs={savedSlugs}
            likedSlugs={likedSlugs}
          />
        </>
      ) : null}

      {[...groups.entries()].map(([slug, bucket], index) => (
        <div key={slug}>
          {index > 0 || featured.length ? <RailDivider className="mb-4" /> : null}
          <Section
            title={findGroup(slug)?.title ?? slug}
            items={bucket.slice(0, 12)}
            onOpen={onOpen}
            onSave={onSave}
            onLike={onLike}
            savedSlugs={savedSlugs}
            likedSlugs={likedSlugs}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * One section: a title and a strip of cards that scrolls sideways.
 *
 * The arrows only appear when there is somewhere to go: a strip that fits on
 * the screen has nothing to scroll to, and an arrow that does nothing is a
 * promise the page cannot keep.
 */
function Section({
  title,
  items,
  onOpen,
  onSave,
  onLike,
  savedSlugs,
  likedSlugs,
}: {
  title: string;
  items: MarketplaceCardItem[];
  onOpen: (slug: string) => void;
  onSave?: (slug: string) => void;
  onLike?: (slug: string) => void;
  savedSlugs?: Record<string, boolean>;
  likedSlugs?: Record<string, boolean>;
}) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    setEdges({
      start: strip.scrollLeft <= 4,
      end: strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    const strip = stripRef.current;
    if (!strip) return;
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [measure, items.length]);

  if (!items.length) return null;

  const scrollBy = (direction: 1 | -1) => {
    const strip = stripRef.current;
    if (!strip) return;
    strip.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            disabled={edges.start}
            aria-label={`Scroll ${title} left`}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            disabled={edges.end}
            aria-label={`Scroll ${title} right`}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={stripRef}
        onScroll={measure}
        className="relative flex snap-x snap-mandatory gap-0 overflow-x-auto border-t border-l border-border/60 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <RailCorners />
        {items.map((item) => (
          <div
            key={item.slug}
            className="w-[19rem] shrink-0 snap-start border-r border-b border-border/60 p-1"
          >
            <ComponentCard
              item={item}
              onSave={onSave}
              onLike={onLike}
              savedSlugs={savedSlugs}
              likedSlugs={likedSlugs}
              onOpen={onOpen}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
