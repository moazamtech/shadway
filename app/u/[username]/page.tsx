import Link from "next/link";
import { notFound } from "next/navigation";
import { Layers, Package } from "lucide-react";
import { listComponents } from "@/lib/db/components";
import { listBundles } from "@/lib/db/bundles";
import { ComponentCard } from "@/components/marketplace/component-card";

export const dynamic = "force-dynamic";

type ComponentListItem = Awaited<ReturnType<typeof listComponents>>[number];

function toCardItem(item: ComponentListItem) {
  return {
    ...item,
    createdAt: item.createdAt ? item.createdAt.toISOString() : undefined,
  };
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const decoded = decodeURIComponent(username);

  const components = await listComponents({ author: decoded, limit: 60 }).catch(() => []);
  const bundles = await listBundles({ author: decoded, limit: 6 }).catch(() => []);

  const author = components[0]?.author ?? bundles[0]?.author;

  if (!author) {
    notFound();
  }

  const totalInstalls = components.reduce((sum, item) => sum + (item.installs || 0), 0);
  const totalLikes = components.reduce((sum, item) => sum + (item.likes || 0), 0);
  const totalViews = components.reduce((sum, item) => sum + (item.views || 0), 0);

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
        </div>
      </header>

      {/* Profile header */}
      <div className="border-b border-border/70">
        {/* Banner */}
        <div className="h-32 bg-gradient-to-r from-primary/20 via-muted to-primary/10 sm:h-40" />

        <div className="mx-auto max-w-[1400px] px-4 lg:px-6">
          <div className="relative -mt-12 flex flex-wrap items-end gap-4 sm:-mt-14">
            <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-4 border-background bg-gradient-to-br from-muted to-muted/50 text-2xl font-bold uppercase text-muted-foreground shadow-lg sm:h-28 sm:w-28">
              {author.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={author.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                (author.username || "?").slice(0, 2)
              )}
            </span>

            <div className="min-w-0 flex-1 pb-2">
              <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
                {author.name || author.username}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">@{author.username}</p>
            </div>

            <div className="flex items-center gap-5 pb-2 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold tabular-nums">{components.length}</div>
                <div className="text-[11px] text-muted-foreground">Components</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold tabular-nums">{formatCount(totalViews)}</div>
                <div className="text-[11px] text-muted-foreground">Views</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold tabular-nums">{formatCount(totalLikes)}</div>
                <div className="text-[11px] text-muted-foreground">Likes</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold tabular-nums">{formatCount(totalInstalls)}</div>
                <div className="text-[11px] text-muted-foreground">Installs</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-6">
        {/* Components */}
        {components.length ? (
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Components
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {components.map((item) => (
                <ComponentCard key={item.slug} item={toCardItem(item)} />
              ))}
            </div>
          </section>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 p-12 text-center">
            <p className="text-sm font-medium">No standalone components yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This creator publishes bundles instead.
            </p>
          </div>
        )}

        {/* Bundles */}
        {bundles.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Package className="h-4 w-4" />
              Bundles
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bundles.map((bundle) => (
                <Link
                  key={bundle.slug}
                  href={`/bundles/${bundle.slug}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4 transition hover:border-foreground/15 hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{bundle.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {bundle.componentSlugs.length}{" "}
                      {bundle.componentSlugs.length === 1 ? "component" : "components"}
                    </p>
                  </div>
                  <Package className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
