"use client";

import { useEffect, useState } from "react";
import { Layers, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BundleCard, type BundleCardItem } from "@/components/marketplace/bundle-card";

/**
 * Browsable list of curated bundles.
 *
 * Mirrors 21st's `BundlesLayout` intent (a list of pack sliders) but uses a
 * plain fetch rather than react-query, which this app does not depend on.
 */
export function BundleList({
  author,
  includePrivate,
  showSearch = true,
}: {
  author?: string;
  includePrivate?: boolean;
  showSearch?: boolean;
}) {
  const [items, setItems] = useState<BundleCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  // Debounced so typing does not fire a request per keystroke.
  const debouncedQuery = useDebounced(query, 250);

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams();
    if (author) params.set("author", author);
    if (includePrivate) params.set("includePrivate", "true");
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());

    setLoading(true);
    fetch(`/api/bundles?${params}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load bundles");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load bundles");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [author, includePrivate, debouncedQuery, reload]);

  const header = showSearch ? (
    <div className="relative max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search bundles..."
        aria-label="Search bundles"
        className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary"
      />
    </div>
  ) : null;

  if (loading && !items.length) {
    return (
      <div className="space-y-4">
        {header}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <p className="text-sm font-medium">Could not load bundles</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => setReload((n) => n + 1)}>
          Retry
        </Button>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Layers className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No bundles yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Group a set of components into a pack to install them together.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((bundle) => (
          <BundleCard key={bundle.slug} bundle={bundle} />
        ))}
      </div>
    </div>
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
