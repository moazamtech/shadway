"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Layers, Plus, Rocket, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Item = {
  slug: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  status: string;
  visibility: string;
  installs: number;
  views: number;
  likes: number;
  createdAt: string;
};

export function StudioDashboard() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/components?limit=60", { cache: "no-store" });
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError("Could not load your components");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(slug: string, patch: Record<string, unknown>) {
    setBusySlug(slug);
    setError(null);
    try {
      const res = await fetch(`/api/components/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      setItems((prev) =>
        prev.map((item) => (item.slug === slug ? { ...item, ...patch } : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusySlug(null);
    }
  }

  async function remove(slug: string) {
    if (!window.confirm(`Delete "${slug}" permanently?`)) return;

    setBusySlug(slug);
    setError(null);
    try {
      const res = await fetch(`/api/components/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setItems((prev) => prev.filter((item) => item.slug !== slug));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusySlug(null);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-4 py-3 lg:px-6">
          <Link href="/" className="font-serif text-base tracking-tight">
            Shadway
          </Link>
          <span className="h-3 w-px bg-border" />
          <span className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Studio
          </span>
          <Button size="sm" className="ml-auto rounded-full" asChild>
            <Link href="/studio">
              <Plus className="mr-1 h-3.5 w-3.5" />
              New component
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-6">
        <div className="mb-6 flex items-center gap-3">
          <Rocket className="h-5 w-5" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Your components</h1>
            <p className="text-sm text-muted-foreground">
              Manage what you have published to the registry.
            </p>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-16 text-center">
            <Layers className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">You have not published anything yet</p>
            <Button className="mt-4 rounded-full" asChild>
              <Link href="/studio">Open the studio</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.slug}
                className="flex flex-wrap items-center gap-4 rounded-xl border p-3"
              >
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted/40">
                  {item.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/c/${item.slug}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {item.title}
                    </Link>
                    {item.status !== "published" && (
                      <Badge variant="secondary">{item.status}</Badge>
                    )}
                    {item.visibility === "unlisted" && (
                      <Badge variant="outline">Unlisted</Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.description || `shadway.com/r/${item.slug}`}
                  </p>
                </div>

                <div className="flex shrink-0 gap-4 text-xs text-muted-foreground">
                  <span>{item.views} views</span>
                  <span>{item.installs} installs</span>
                  <span>{item.likes} likes</span>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    disabled={busySlug === item.slug}
                    onClick={() =>
                      void update(item.slug, {
                        visibility:
                          item.visibility === "public" ? "unlisted" : "public",
                      })
                    }
                    title={item.visibility === "public" ? "Make unlisted" : "Make public"}
                  >
                    {item.visibility === "public" ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive hover:text-destructive"
                    disabled={busySlug === item.slug}
                    onClick={() => void remove(item.slug)}
                    title="Delete component"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}