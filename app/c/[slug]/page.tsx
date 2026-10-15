"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Bookmark,
  Check,
  Copy,
  Download,
  Eye,
  Heart,
  Layers,
  Share2,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BundledPreview } from "@/components/preview/bundled-preview";
import { InstallTabs } from "@/components/marketplace/install-tabs";

type Item = {
  slug: string;
  title: string;
  description: string;
  author: { name: string; username: string; avatar?: string };
  tags: string[];
  dependencies: string[];
  registryDependencies: string[];
  code: string;
  demoCode?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  installs: number;
  views: number;
  likes: number;
  category?: string;
  createdAt?: string;
};

type Tab = "preview" | "code" | "install";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function ComponentDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug;

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("preview");
  const [copied, setCopied] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    fetch("/api/components/bookmarks", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { slugs: [] }))
      .then((data) => {
        if (!cancelled) setSaved((data.slugs ?? []).includes(slug));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function vote() {
    if (!item) return;
    const next = !voted;
    setVoted(next);
    try {
      const res = await fetch("/api/components/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: item.slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.voted === "boolean") setVoted(data.voted);
    } catch {
      setVoted(!next);
    }
  }

  async function toggleSave() {
    if (!item) return;
    const next = !saved;
    setSaved(next);
    try {
      const res = await fetch("/api/components/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: item.slug, action: next ? "save" : "remove" }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setSaved(!next);
    }
  }

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/components/${encodeURIComponent(slug)}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("not found");
        const data = await response.json();
        if (!cancelled) setItem(data.item);
      } catch {
        if (!cancelled) setItem(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-foreground" />
          <span className="text-sm text-muted-foreground">Loading component...</span>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-sm text-muted-foreground">
        <p className="text-lg font-medium text-foreground">Component not found</p>
        <p>The component you are looking for does not exist or has been removed.</p>
        <Button asChild variant="outline">
          <Link href="/">Back to feed</Link>
        </Button>
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://shadway.com";
  const installCommand = `npx shadcn@latest add ${origin}/r/${item.slug}`;
  const registryUrl = `${origin}/r/${item.slug}`;

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 lg:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 bg-muted/40">
              <Layers className="h-4 w-4" />
            </span>
            <span className="font-serif text-sm font-semibold tracking-tight">Shadway</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="truncate text-sm font-medium">{item.title}</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => copy(registryUrl, "link")}>
              {copied === "link" ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              <span className="hidden sm:inline">Share</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/studio")}>
              Remix
            </Button>
            <Button
              variant={saved ? "secondary" : "outline"}
              size="sm"
              onClick={() => void toggleSave()}
              title={saved ? "Remove from saved" : "Save for later"}
            >
              {saved ? <Bookmark className="h-4 w-4 fill-current" /> : <Bookmark className="h-4 w-4" />}
            </Button>
            <Button size="sm" onClick={() => copy(installCommand, "install")}>
              {copied === "install" ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              Install
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-6">
        {/* Hero */}
        <div className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {item.category && (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {item.category}
                  </span>
                )}
              </div>
              <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
                {item.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {item.description}
              </p>

              {/* Author + stats row */}
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <Link
                  href={`/u/${item.author.username}`}
                  className="flex items-center gap-2.5 rounded-full border border-border/70 bg-muted/30 py-1.5 pl-1.5 pr-3 transition hover:bg-muted/60"
                >
                  <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-muted to-muted/50 text-[10px] font-bold uppercase text-muted-foreground">
                    {item.author.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.author.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      item.author.username.slice(0, 2)
                    )}
                  </span>
                  <span className="text-sm font-medium">{item.author.name}</span>
                  <span className="text-xs text-muted-foreground">@{item.author.username}</span>
                </Link>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5" title={`${item.views} views`}>
                    <Eye className="h-4 w-4" />
                    {formatCount(item.views)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void vote()}
                    className={`flex items-center gap-1.5 transition hover:text-foreground ${
                      voted ? "text-destructive" : ""
                    }`}
                    title="Upvote this component"
                  >
                    <Heart className={`h-4 w-4 ${voted ? "fill-current" : ""}`} />
                    {formatCount(item.likes + (voted ? 1 : 0))}
                  </button>
                  <span className="flex items-center gap-1.5" title={`${item.installs} installs`}>
                    <Download className="h-4 w-4" />
                    {formatCount(item.installs)}
                  </span>
                </div>
              </div>

              {item.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center gap-1 border-b border-border/70 bg-muted/30 px-3 py-2">
            {(
              [
                { id: "preview", label: "Preview", icon: Eye },
                { id: "code", label: "Code", icon: Copy },
                { id: "install", label: "Install", icon: Terminal },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition ${
                    tab === t.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === "preview" && (
            <div className="bg-background">
              <BundledPreview slug={item.slug} height={560} />
            </div>
          )}

          {tab === "code" && (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="absolute right-3 top-3 z-10"
                onClick={() => copy(item.code, "code")}
              >
                {copied === "code" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy
              </Button>
              <pre className="max-h-[560px] overflow-auto bg-zinc-950 p-5 text-xs leading-6 text-zinc-200">
                <code>{item.code}</code>
              </pre>
            </div>
          )}

          {tab === "install" && (
            <div className="space-y-5 p-5 sm:p-6">
              <InstallTabs
                slug={item.slug}
                dependencies={item.dependencies}
                registryDependencies={item.registryDependencies}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
                <p className="text-sm text-muted-foreground">
                  Published by{" "}
                  <Link
                    href={`/u/${item.author.username}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    @{item.author.username}
                  </Link>
                </p>
                <Button variant="outline" size="sm" onClick={() => router.push("/studio")}>
                  Remix in studio
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
