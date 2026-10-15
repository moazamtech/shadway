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
};

type Tab = "preview" | "code" | "install";

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
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading component...
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-sm text-muted-foreground">
        <p>Component not found.</p>
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
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-4 py-3 lg:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            <span className="text-sm font-semibold tracking-tight">Shadway</span>
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
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

      <div className="mx-auto max-w-[1200px] px-4 py-6 lg:px-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{item.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {item.tags.slice(0, 6).map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {item.views}
            </span>
            <button
              type="button"
              onClick={() => void vote()}
              className={`flex items-center gap-1 transition hover:text-foreground ${
                voted ? "text-destructive" : ""
              }`}
              title="Upvote this component"
            >
              <Heart className={`h-4 w-4 ${voted ? "fill-current" : ""}`} />
              {item.likes + (voted ? 1 : 0)}
            </button>
            <span className="flex items-center gap-1">
              <Download className="h-4 w-4" />
              {item.installs}
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border">
          <div className="flex items-center gap-1 border-b bg-muted/30 px-2 py-1.5">
            {(
              [
                { id: "preview", label: "Preview", icon: Eye },
                { id: "code", label: "Code", icon: Copy },
                { id: "install", label: "Install", icon: Terminal },
              ] as const
            ).map((itemTab) => {
              const Icon = itemTab.icon;
              return (
                <button
                  key={itemTab.id}
                  onClick={() => setTab(itemTab.id)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    tab === itemTab.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {itemTab.label}
                </button>
              );
            })}
          </div>

          {tab === "preview" && (
            <div className="bg-background">
              <BundledPreview slug={item.slug} height={520} />
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
            <div className="space-y-4 p-5">
              <InstallTabs
                slug={item.slug}
                dependencies={item.dependencies}
                registryDependencies={item.registryDependencies}
              />

              <div className="flex items-center justify-between border-t pt-4">
                <div className="text-sm text-muted-foreground">
                  Published by <span className="font-medium text-foreground">@{item.author.username}</span>
                </div>
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

