"use client";

/**
 * The component detail page, interactive half.
 *
 * This was `page.tsx` itself until the OG image had to be per-component. Next
 * only builds `<head>` from `generateMetadata`, which is server-only, and a
 * `"use client"` page cannot export one — so a share card was the one thing a
 * component page could never have. The split puts the metadata in the thin
 * server `page.tsx` next door and leaves everything that needs a browser here.
 *
 * How the data arrives is unchanged, deliberately: it still reads the slug from
 * `useParams` and still fetches `/api/components/[slug]` itself, rather than
 * taking the record as a prop from the server. Handing it down would have meant
 * shipping the author's whole source string into the RSC payload for a page
 * that only needs its title and cover for the `<head>`.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Bookmark,
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  Heart,
  Maximize2,
  Share2,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { coverImageUrl } from "@/lib/images";
import { useOrigin } from "@/hooks/use-origin";
import { BundledPreview } from "@/components/preview/bundled-preview";
import { ComponentCodeTabs } from "@/components/marketplace/component-code-tabs";
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
  /** Where the author keeps the component. Absent on older records. */
  componentPath?: string;
  demoCode?: string;
  styleCode?: string;
  files?: { path: string; content: string }[];
  thumbnailUrl?: string;
  videoUrl?: string;
  installs: number;
  views: number;
  likes: number;
  bookmarks?: number;
  category?: string;
  createdAt?: string;
  /** Present (and not "published") only for the owner or an admin. */
  status?: "draft" | "pending" | "published" | "hidden" | "flagged";
};

type Tab = "preview" | "code" | "install";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "preview", label: "Preview", icon: Eye },
  { id: "code", label: "Code", icon: Code2 },
  { id: "install", label: "Install", icon: Terminal },
];

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* The segmented thumb: a sliding plate under three equal cells, so the
   selected view reads as one physical switch. */
function SegmentedTabs({
  tab,
  onChange,
  className,
  tabs,
}: {
  tab: Tab;
  onChange: (tab: Tab) => void;
  className?: string;
  /** Shown tabs — the Install tab stays off until it is approved. */
  tabs: typeof TABS;
}) {
  const index = tabs.findIndex((t) => t.id === tab);
  const cols = Math.max(tabs.length, 1);
  return (
    <div
      role="tablist"
      aria-label="Component view"
      className={cn(
        "relative grid h-8 rounded-lg bg-muted p-0.5",
        className
      )}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0.5 rounded-md bg-background shadow-sm transition-[left] duration-200 ease-out"
        style={{
          width: `calc((100% - 4px) / ${cols})`,
          left: index >= 0 ? `calc(2px + ${index} * ((100% - 4px) / ${cols}))` : "-9999px",
        }}
      />
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative z-10 flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-[13px] font-medium transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden md:block">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function ComponentDetailClient() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug;

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("preview");
  const [copied, setCopied] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

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

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(
          `/api/components/${encodeURIComponent(slug!)}`,
          { cache: "no-store" }
        );
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

  const origin = useOrigin();
  const installCommand = item ? `npx shadcn@latest add ${origin}/r/${item.slug}` : "";
  const registryUrl = item ? `${origin}/r/${item.slug}` : "";

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {}
  }

  async function vote() {
    if (!item) return;
    const next = !voted;
    setVoted(next);
    try {
      const res = await fetch(
        `/api/components/${encodeURIComponent(item.slug)}/like`,
        { method: voted ? "DELETE" : "POST" }
      );
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
        body: JSON.stringify({
          slug: item.slug,
          action: next ? "save" : "remove",
        }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setSaved(!next);
    }
  }

  const npmDeps = useMemo(
    () => (item?.dependencies ?? []).filter(Boolean),
    [item]
  );

  // Install stays offline until the admin approves: /r serves published
  // components only, so the UI never offers a command that would 404.
  const isPublished = !item?.status || item.status === "published";
  const visibleTabs = useMemo(
    () => (isPublished ? TABS : TABS.filter((t) => t.id !== "install")),
    [isPublished]
  );

  const statusNotice: { title: string; body: string } | null = isPublished
    ? null
    : item?.status === "pending"
      ? {
          title: "In review",
          body:
            "Only you and the reviewers can see this page right now. An admin approves it — then the install command turns on and it appears in the feed.",
        }
      : item?.status === "draft"
        ? {
            title: "Draft",
            body: "This component is not submitted. Open the studio and send it for review.",
          }
        : {
            title: "Not public",
            body: "This component is not available publicly. It stays visible to you and the admins only.",
          };

  if (loading) {
    return (
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <div className="h-5 w-5 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-8 w-64 animate-pulse rounded-lg bg-muted" />
        </header>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="min-h-0 flex-1 animate-pulse bg-muted/40" />
          <div className="w-full shrink-0 space-y-4 border-t border-border p-5 lg:w-[360px] lg:border-t-0 lg:border-l">
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background text-sm text-muted-foreground">
        <p className="text-lg font-medium text-foreground">Component not found</p>
        <p>The component you are looking for does not exist or has been removed.</p>
        <Button asChild variant="outline">
          <Link href="/">Back to feed</Link>
        </Button>
      </div>
    );
  }

  const authorName = item.author.name || item.author.username;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground lg:h-dvh lg:min-h-0">
      {/* Top bar: brand → author crumb → actions. */}
      <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-1.5 border-b border-border bg-background px-3 lg:static lg:gap-2 lg:px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2"
          aria-label="Shadway home"
        >
          <BrandMark size={24} />
          <span className="hidden text-sm font-semibold tracking-tight sm:block">
            Shadway
          </span>
        </Link>

        <span aria-hidden className="px-0.5 text-sm text-muted-foreground select-none">
          /
        </span>

        <Link
          href={`/u/${item.author.username}`}
          className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-accent"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-bold uppercase text-muted-foreground">
            {item.author.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImageUrl(item.author.avatar, 96)}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              item.author.username.slice(0, 2)
            )}
          </span>
          <span className="truncate text-sm font-medium">{item.title}</span>
        </Link>

        {item.category ? (
          <span className="hidden rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase lg:block">
            {item.category}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          <SegmentedTabs tab={tab} onChange={setTab} className="hidden md:grid" tabs={visibleTabs} />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copy link"
                onClick={() => copy(registryUrl, "link")}
              >
                {copied === "link" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isPublished ? "Copy link" : "Copy private link"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={saved ? "Remove bookmark" : "Bookmark"}
                onClick={() => void toggleSave()}
              >
                <Bookmark
                  className={cn("h-4 w-4", saved && "fill-current")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{saved ? "Remove bookmark" : "Bookmark"}</TooltipContent>
          </Tooltip>

          {isPublished ? (
            <Button
              size="sm"
              onClick={() => copy(installCommand, "install")}
              className="ml-1"
            >
              {copied === "install" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {copied === "install" ? "Copied" : "Install"}
              </span>
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="ml-1" asChild>
              <Link href="/studio">Open studio</Link>
            </Button>
          )}
        </div>
      </header>

      {statusNotice && (
        <div
          className={
            item?.status === "pending"
              ? "shrink-0 bg-amber-500/10 px-4 py-2.5 text-sm md:px-6 md:py-3"
              : "shrink-0 bg-muted/60 px-4 py-2.5 text-sm md:px-6 md:py-3"
          }
          role="status"
        >
          <span className="font-semibold">{statusNotice.title}.</span>{" "}
          <span className="text-muted-foreground">
            {statusNotice.body} Anyone else visiting this address sees
            &ldquo;component not found&rdquo;.
          </span>
        </div>
      )}

      {/* Mobile view switcher */}
      <div className="border-b border-border px-3 py-2 md:hidden">
        <SegmentedTabs tab={tab} onChange={setTab} className="w-full" tabs={visibleTabs} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Work area: the selected view fills the pane. */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-border lg:border-b-0">
          {tab === "preview" ? (
            <div className="relative h-[340px] sm:h-[440px] lg:h-full lg:min-h-0">
              <BundledPreview
                slug={item.slug}
                height="100%"
                poster={item.thumbnailUrl}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Open fullscreen preview"
                    onClick={() => setFullscreen(true)}
                    className="absolute top-3 right-3 z-10 bg-surface"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Fullscreen</TooltipContent>
              </Tooltip>
            </div>
          ) : null}

          {tab === "code" ? (
            <ComponentCodeTabs slug={item.slug} source={item} className="min-h-[420px] lg:h-full" />
          ) : null}

          {tab === "install" ? (
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 lg:px-6">
              <InstallTabs
                slug={item.slug}
                dependencies={item.dependencies}
                registryDependencies={item.registryDependencies}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">
                  Published by{" "}
                  <Link
                    href={`/u/${item.author.username}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    @{item.author.username}
                  </Link>
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/studio")}
                >
                  Remix in studio
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        {/* Info rail: author, actions, stats, install, metadata. */}
        <aside className="w-full shrink-0 space-y-5 px-4 py-5 lg:w-[360px] lg:min-h-0 lg:space-y-5 lg:overflow-y-auto lg:border-l lg:border-border lg:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold uppercase text-muted-foreground">
              {item.author.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverImageUrl(item.author.avatar, 96)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                item.author.username.slice(0, 2)
              )}
            </span>
            <div className="min-w-0">
              <Link
                href={`/u/${item.author.username}`}
                className="block truncate text-sm font-medium hover:underline"
              >
                {authorName}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                @{item.author.username}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="ml-auto shrink-0"
            >
              <Link href={`/u/${item.author.username}`}>Profile</Link>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={voted ? "secondary" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => void vote()}
              title="Upvote this component"
            >
              <Heart
                className={cn("h-3.5 w-3.5", voted && "fill-current text-rose-500")}
              />
              {voted ? "Liked" : "Like"}
            </Button>
            <Button
              variant={saved ? "secondary" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => void toggleSave()}
              title={saved ? "Remove from bookmarks" : "Save for later"}
            >
              <Bookmark className={cn("h-3.5 w-3.5", saved && "fill-current")} />
              {saved ? "Saved" : "Save"}
            </Button>
          </div>

          {item.description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          ) : null}

          {/* Installs only. Views and likes are deliberately absent from the
              public surface: they nudge visitors away from components that have
              not been liked yet, which is the opposite of what a catalogue is
              for. The owner's own studio dashboard still shows the full set. */}
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5">
            <Download className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium tabular-nums">
              {formatCount(item.installs)}
            </span>
            <span className="text-sm text-muted-foreground">installs</span>
          </div>

          {item.tags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {isPublished ? (
            <div className="space-y-2">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Install
              </h2>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-well p-1.5 pl-3">
                <code className="min-w-0 flex-1 truncate font-mono text-xs">
                  {installCommand}
                </code>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Copy install command"
                  onClick={() => copy(installCommand, "install-rail")}
                >
                  {copied === "install-rail" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          {npmDeps.length || item.registryDependencies.length ? (
            <div className="space-y-2">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Dependencies
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {npmDeps.map((dep) => (
                  <span
                    key={`npm-${dep}`}
                    className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                  >
                    {dep}
                  </span>
                ))}
                {item.registryDependencies.map((dep) => (
                  <span
                    key={`reg-${dep}`}
                    className="rounded-md border border-dashed border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                  >
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <dl className="space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">License</dt>
              <dd>MIT</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Published</dt>
              <dd>{formatDate(item.createdAt)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Registry</dt>
              <dd className="max-w-[180px] truncate font-mono text-xs">
                /r/{item.slug}
              </dd>
            </div>
          </dl>
        </aside>
      </div>

      {/* Fullscreen preview */}
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-none gap-0 overflow-hidden p-0 sm:max-w-[min(1400px,94vw)]">
          <DialogTitle className="sr-only">{item.title} preview</DialogTitle>
          <div className="h-[min(860px,88vh)] w-full">
            <BundledPreview
              slug={item.slug}
              height="100%"
              poster={item.thumbnailUrl}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
