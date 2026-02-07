"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/navbar";
import { VibecodeComponent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, Sparkles, Search } from "lucide-react";
import { TextHoverEffect } from "@/components/site-components/text-hover-effect";
import Image from "next/image";

export default function VibecodePage() {
  const [items, setItems] = useState<VibecodeComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 21; // 7 rows on the current 3-column desktop grid

  const getShortTitle = (title: string) =>
    title.split(/\s+/).slice(0, 3).join(" ");

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch("/api/vibecode");
        if (!response.ok) {
          throw new Error("Failed to fetch vibecode items.");
        }
        const data = (await response.json()) as VibecodeComponent[];
        setItems(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load vibecode.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return ["All", ...Array.from(set)];
  }, [items]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (activeCategory !== "All" && item.category !== activeCategory)
        return false;
      if (!normalizedQuery) return true;
      const haystack = [
        item.title,
        item.description,
        item.category,
        ...(item.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [items, query, activeCategory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, activeCategory]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="relative mx-auto w-full max-w-7xl overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-[2px] bg-border/70" />
        <div className="absolute inset-y-0 left-2 w-[2px] bg-border/40" />
        <div className="absolute inset-y-0 right-0 w-[2px] bg-border/70" />
        <div className="absolute inset-y-0 right-2 w-[2px] bg-border/40" />
        <section className="relative pt-28 pb-16 px-6 lg:px-12">
          <div className="max-w-7xl mx-auto relative">
            <div className="flex flex-col gap-6">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <Sparkles className="h-4 w-4" />
                Vibecode Gallery
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
                  Published AI components, ready to remix.
                </h1>
                <p className="text-muted-foreground text-base md:text-lg max-w-2xl">
                  Explore the latest components generated in Shadway. Preview
                  each build, copy the code, and speed up your next interface.
                </p>
              </div>
              <div className="flex flex-col gap-6">
                <div className="relative max-w-xl">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-70" />
                  <div className="relative flex items-center rounded-xl border border-border/60 bg-card/80 px-3.5 py-2.5 transition-colors duration-200 hover:border-primary/30 focus-within:border-primary/40">
                    <Search className="mr-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search components..."
                      className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/70"
                    />
                    <span className="ml-2 hidden font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:inline-block">
                      /
                    </span>
                  </div>
                </div>

                <div className="max-w-xl">
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => setActiveCategory(category)}
                        className={`
                          px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border
                          ${
                            category === activeCategory
                              ? "border-primary/40 bg-card text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                              : "border-border/60 bg-card/70 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                          }
                        `}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 lg:px-12 pb-20">
          <div className="max-w-6xl mx-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading vibecode components...
              </div>
            ) : error ? (
              <div className="text-center text-muted-foreground py-16">
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-muted-foreground py-16">
                No published components yet.
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {paginatedItems.map((item) => (
                    <div
                      key={item._id || item.slug}
                      className="group rounded-sm overflow-hidden"
                    >
                      <div className="relative aspect-[16/9] w-full bg-muted/20">
                        <Image
                          src={item.thumbnailUrl || "/placeholder-image.jpg"}
                          alt={item.title}
                          width={1980}
                          height={1080}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <Button size="sm" asChild>
                            <Link href={`/vibecode/${item.slug}`}>
                              View Details
                            </Link>
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Image
                          src="/vibecoder.png"
                          alt="Vibecoder"
                          width={36}
                          height={36}
                          className="h-9 w-9 rounded-full object-cover"
                        />
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-semibold text-foreground">
                            {getShortTitle(item.title)}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {item.description}
                          </p>
                        </div>
                        <span className="mt-auto text-xs font-semibold text-muted-foreground">
                          Free
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="px-3 py-1 text-xs font-mono text-muted-foreground">
                      Page {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
        <div className="flex flex-col">
          <div className="w-full border-b border-dashed border-border" />
          <div className="w-full h-4 bg-[image:repeating-linear-gradient(45deg,transparent,transparent_4px,var(--color-border)_4px,var(--color-border)_5px)] opacity-20" />
          <div className="w-full border-b border-dashed border-border" />
        </div>
        <div className="items-center justify-start mx-auto max-w-[1300px] overflow-x-hidden">
          <TextHoverEffect text="SHADWAY" />
        </div>
      </div>
    </div>
  );
}
