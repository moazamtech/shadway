"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Library, Search, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ComponentCard,
  type MarketplaceCardItem,
} from "@/components/marketplace/component-card";

const CATEGORIES = ["all", "ui", "block", "marketing", "animation", "form", "data"];

export function ComponentExchangeHome() {
  const [items, setItems] = useState<MarketplaceCardItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [savedSlugs, setSavedSlugs] = useState<Record<string, boolean>>({});

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
        if (!cancelled && Array.isArray(data.items)) setItems(data.items);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "all" && !item.tags.includes(category)) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        item.author.username.toLowerCase().includes(q)
      );
    });
  }, [items, query, category]);

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

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 lg:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            <span className="text-sm font-semibold tracking-tight">Shadway</span>
          </Link>

          <Link
            href="/collections"
            className="hidden items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground sm:flex"
          >
            <Library className="h-4 w-4" />
            Collections
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
          <div className="rounded-2xl border border-dashed p-16 text-center">
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