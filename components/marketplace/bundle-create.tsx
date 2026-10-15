"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Layers, Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MarketplaceCardItem } from "@/components/marketplace/component-card";

/**
 * Bundle creation.
 *
 * 21st has no equivalent — its bundles are created directly in the database,
 * behind a "contact support" beta notice. This is the flow that was missing.
 */
export function BundleCreate() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<MarketplaceCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/components?sort=latest&limit=60", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (!cancelled) setOptions(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [options, query]);

  const toggle = useCallback((slug: string) => {
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug]
    );
  }, []);

  async function create() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, componentSlugs: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create bundle");
      router.push(`/bundles/${data.item.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create bundle");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 lg:px-6">
      <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New bundle</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Group components into a pack your users install with one command.
            </p>
          </div>

          <label className="block space-y-1 text-sm font-medium">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Marketing sections"
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
            />
          </label>

          <label className="block space-y-1 text-sm font-medium">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Heroes, pricing and CTA blocks for a landing page."
              className="min-h-24 w-full rounded-lg border bg-background p-3 text-sm"
            />
          </label>

          <div className="rounded-xl border p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Preview
            </p>
            <code className="mt-1.5 block break-all rounded bg-muted p-2 text-[11px]">
              /r/bundle/
              {name.trim()
                ? name
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, "") || "your-bundle"
                : "your-bundle"}
            </code>
            <p className="mt-2 text-xs text-muted-foreground">
              {selected.length} component{selected.length === 1 ? "" : "s"} selected
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            className="w-full"
            size="lg"
            disabled={submitting || name.trim().length < 3 || !selected.length}
            onClick={create}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create bundle
          </Button>
          <p className="text-xs text-muted-foreground">
            New bundles start private. Publish it when the curation is ready.
          </p>
        </div>

        <div className="min-w-0">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search components..."
              aria-label="Search components"
              className="h-9 w-full max-w-sm rounded-lg border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary"
            />
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-44 animate-pulse rounded-xl bg-muted/40" />
              ))}
            </div>
          ) : visible.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {visible.map((item) => {
                const picked = selected.includes(item.slug);
                return (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => toggle(item.slug)}
                    className={`group relative overflow-hidden rounded-xl border text-left transition ${
                      picked ? "border-primary ring-1 ring-primary" : "hover:border-foreground/20"
                    }`}
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-muted/40">
                      {item.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Layers className="h-5 w-5" />
                        </div>
                      )}
                    </div>

                    <span
                      className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border shadow-sm transition ${
                        picked ? "bg-primary text-primary-foreground" : "bg-background/90"
                      }`}
                    >
                      {picked ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    </span>

                    <div className="p-3">
                      <p className="truncate text-xs font-medium">{item.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
              No components match that search.
            </p>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border bg-background px-4 py-2 shadow-lg">
          <span className="text-xs font-medium">
            {selected.length} selected
          </span>
          {selected.slice(0, 4).map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => toggle(slug)}
              className="flex h-6 w-6 items-center justify-center rounded-full border bg-muted text-[10px] font-semibold hover:bg-destructive hover:text-destructive-foreground"
              title={slug}
            >
              {slug.slice(0, 2).toUpperCase()}
              <X className="sr-only" />
            </button>
          ))}
          <Button size="sm" variant="ghost" asChild>
            <Link href="/bundles">Cancel</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
