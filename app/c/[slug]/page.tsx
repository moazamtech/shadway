"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ComponentSandpackPreview } from "@/components/component-sandpack-preview";
import { Button } from "@/components/ui/button";

type Item = {
  slug: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  title: string;
  description: string;
  author: { name: string; username: string; avatar?: string };
  tags: string[];
  dependencies: string[];
  registryDependencies: string[];
  code: string;
  installs: number;
  views: number;
  likes: number;
};

export default function ComponentDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/components/${encodeURIComponent(slug)}`, { cache: "no-store" });
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

  if (loading) return <div className="p-10 text-center text-muted-foreground">Loading component...</div>;
  if (!item) return <div className="p-10 text-center text-muted-foreground">Component not found.</div>;

  async function copyInstall() {
    try {
      await navigator.clipboard.writeText(`npx shadcn@latest add https://shadway.com/r/${item.slug}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">{item.author.username}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{item.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
          </div>
          <Button onClick={copyInstall}>{copied ? "Copied" : "Copy install command"}</Button>
        </div>

        {(item.thumbnailUrl || item.videoUrl) && (
          <div className="mb-6 overflow-hidden rounded-2xl border">
            {item.videoUrl ? (
              <video src={item.videoUrl} className="aspect-video w-full" controls />
            ) : (
              <img src={item.thumbnailUrl} alt={item.title} className="aspect-video w-full object-cover" />
            )}
          </div>
        )}

        <ComponentSandpackPreview code={item.code} title={item.title} dependencies={item.dependencies} />

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border p-4">
            <h2 className="mb-3 text-sm font-semibold">Code</h2>
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs">
              <code>{item.code}</code>
            </pre>
          </section>
          <section className="rounded-2xl border p-4">
            <h2 className="mb-3 text-sm font-semibold">Install</h2>
            <code className="block rounded-lg bg-muted p-4 text-xs">npx shadcn@latest add https://shadway.com/r/{item.slug}</code>
            <h2 className="mb-2 mt-6 text-sm font-semibold">Metadata</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Dependencies</dt>
                <dd>{item.dependencies.length ? item.dependencies.join(", ") : "none"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Registry deps</dt>
                <dd>{item.registryDependencies.length ? item.registryDependencies.join(", ") : "none"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Stats</dt>
                <dd>{item.installs} installs · {item.likes} likes · {item.views} views</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </main>
  );
}
