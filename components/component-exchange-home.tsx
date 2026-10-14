"use client";

import { useEffect, useMemo, useState } from "react";
import { ComponentSandpackPreview } from "@/components/component-sandpack-preview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type FeedItem = {
  slug: string;
  title: string;
  description: string;
  author: { name: string; username: string; avatar?: string };
  tags: string[];
  dependencies: string[];
  code: string;
  installs: number;
  views: number;
  likes: number;
};

const MOCK_ITEMS: FeedItem[] = [
  {
    slug: "pulse-button",
    title: "Pulse Button",
    description: "A minimal self-contained button with animated pulse ring.",
    author: { name: "Shadway", username: "shadway" },
    tags: ["button", "animation", "ui"],
    dependencies: [],
    installs: 128,
    views: 1840,
    likes: 42,
    code: `export default function App() {
  return (
    <button className="relative inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white overflow-hidden">
      <span className="absolute inset-0 animate-ping rounded-md bg-zinc-300/20" />
      <span className="relative">Pulse Button</span>
    </button>
  );
}`,
  },
  {
    slug: "neo-card",
    title: "Neo Card",
    description: "Layered card with glass effect and status chip.",
    author: { name: "Shadway", username: "shadway" },
    tags: ["card", "glass", "layout"],
    dependencies: [],
    installs: 84,
    views: 960,
    likes: 31,
    code: `export default function App() {
  return (
    <div className="w-72 rounded-2xl border border-white/10 bg-white/5 p-5 text-white backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">Neo Card</span>
        <span className="rounded-full bg-emerald-400/20 px-2 py-1 text-xs text-emerald-300">Live</span>
      </div>
      <p className="text-sm text-white/70">Composable surface for component previews.</p>
    </div>
  );
}`,
  },
];

export function ComponentExchangeHome() {
  const [items, setItems] = useState<FeedItem[]>(MOCK_ITEMS);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/components?sort=latest&limit=36", { cache: "no-store" });
        if (!res.ok) throw new Error("feed unavailable");
        const data = await res.json();
        if (!cancelled && Array.isArray(data.items) && data.items.length) {
          setItems(
            data.items.map((item: any) => ({
              slug: item.slug,
              title: item.title,
              description: item.description,
              author: item.author,
              tags: item.tags || [],
              dependencies: item.dependencies || [],
              code: item.code,
              installs: item.installs || 0,
              views: item.views || 0,
              likes: item.likes || 0,
            }))
          );
        }
      } catch {
        // Keep mock data as resilient fallback.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [items, query]);

  async function copyInstall(slug: string) {
    try {
      await navigator.clipboard.writeText(`npx shadcn@latest add https://shadway.com/r/${slug}`);
      setCopiedSlug(slug);
      window.setTimeout(() => setCopiedSlug((current) => (current === slug ? null : current)), 1600);
    } catch {
      setCopiedSlug(null);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1600px] gap-6 px-4 py-6 lg:px-6">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-6 space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Shadway</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">Component Exchange</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Installable shadcn components published by design engineers.
              </p>
            </div>
            <div className="space-y-2">
              {["ui", "marketing", "animation", "form", "data"].map((category) => (
                <button
                  key={category}
                  className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm capitalize transition-colors hover:bg-muted"
                  type="button"
                >
                  <span>{category}</span>
                  <span className="text-xs text-muted-foreground">feed</span>
                </button>
              ))}
            </div>
            <Button className="w-full" asChild>
              <a href="/new">Publish component</a>
            </Button>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">Live component wall</h2>
              <p className="text-sm text-muted-foreground">
                Every card is a real Sandpack preview. {loading ? "Refreshing..." : `${filtered.length} components`}
              </p>
            </div>
            <div className="flex-1 md:max-w-md">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-primary"
                placeholder="Search component, tag, or author..."
                aria-label="Search components"
              />
            </div>
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-2 lg:hidden">
            {["ui", "marketing", "animation", "form", "data"].map((category) => (
              <Badge key={category} variant="outline" className="capitalize">
                {category}
              </Badge>
            ))}
          </div>

          <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
            {filtered.map((item, index) => {
              const install = `npx shadcn@latest add https://shadway.com/r/${item.slug}`;
              return (
                <article
                  key={item.slug}
                  className={`mb-4 break-inside-avoid rounded-2xl border bg-card p-3 shadow-sm transition hover:shadow-md ${
                    index % 5 === 0 ? "md:col-span-2" : ""
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        {item.author.username}
                      </p>
                      <h3 className="text-base font-semibold leading-tight">{item.title}</h3>
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0" asChild>
                      <a href={`/c/${item.slug}`}>Open</a>
                    </Button>
                  </div>

                  <ComponentSandpackPreview code={item.code} title={item.title} dependencies={item.dependencies} />

                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.tags.slice(0, 4).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      {item.installs} installs · {item.likes} likes · {item.views} views
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyInstall(item.slug)}
                    >
                      {copiedSlug === item.slug ? "Copied" : "Copy install"}
                    </Button>
                  </div>

                  <code className="mt-3 block overflow-hidden text-ellipsis rounded-md bg-muted px-2 py-1 text-xs">
                    {install}
                  </code>
                </article>
              );
            })}
          </div>

          {!filtered.length && !loading && (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
              No components matched. Publish the first one.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
