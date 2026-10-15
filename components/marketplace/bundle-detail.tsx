"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Download,
  Loader2,
  Lock,
  Package,
  Rocket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fromCents } from "@/components/marketplace/bundle-card";
import { BundleManage } from "@/components/marketplace/bundle-manage";
import type { PresentedComponent, PresentedPlan, PresentedPurchase } from "@/lib/bundles/present";

/** Only the fields the detail view renders, so pages pass a narrow payload. */
export type BundleDetailBundle = {
  slug: string;
  name: string;
  description: string;
  coverImageUrl?: string;
  author: PresentedComponent["author"];
  plans: PresentedPlan[];
  purchase: PresentedPurchase | null;
  isFree: boolean;
  isPublic: boolean;
  canReadSource: boolean;
  isAuthor: boolean;
};

type Props = {
  bundle: BundleDetailBundle;
  components: PresentedComponent[];
};

/**
 * Detail view for a curated pack.
 *
 * The headline action is the single-command install served by
 * `/r/bundle/<slug>` — the thing 21st cannot do.
 */
export function BundleDetail({ bundle, components }: Props) {
  const [claimed, setClaimed] = useState(bundle.purchase?.status === "paid");
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canInstall = bundle.isFree || claimed || bundle.canReadSource;
  const owned = bundle.isFree || claimed;

  async function claim() {
    setClaiming(true);
    setError(null);
    try {
      const response = await fetch(`/api/bundles/${bundle.slug}/purchase`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to add bundle");
      setClaimed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add bundle");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 lg:px-6">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Package className="h-3 w-3" />
              {components.length} {components.length === 1 ? "component" : "components"}
            </Badge>
            {bundle.isFree ? (
              <Badge variant="outline">Free</Badge>
            ) : (
              bundle.plans.map((plan) => (
                <Badge key={plan.type} variant="outline" className="capitalize">
                  {plan.type} {fromCents(plan.price)}
                </Badge>
              ))
            )}
          </div>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{bundle.name}</h1>

          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border bg-muted text-[10px] font-semibold">
              {bundle.author.username.slice(0, 2).toUpperCase()}
            </span>
            <Link href={`/u/${bundle.author.username}`} className="hover:underline">
              @{bundle.author.username}
            </Link>
          </div>

          {bundle.description && (
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
              {bundle.description}
            </p>
          )}

          {components.length ? (
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {components.map((component) => (
                <BundleComponentCard
                  key={component.slug}
                  component={component}
                  locked={!bundle.canReadSource}
                />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-xl border border-dashed p-12 text-center">
              <p className="text-sm font-medium">No components in this bundle yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The curator has not published the contents of this pack.
              </p>
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {bundle.isAuthor && (
            <BundleManage
              slug={bundle.slug}
              isPublic={bundle.isPublic}
              plans={bundle.plans}
              components={components}
            />
          )}

          <div className="rounded-xl border">
            <div className="border-b px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Install the whole bundle
            </div>
            <div className="space-y-3 p-4">
              {canInstall ? (
                <InstallCommand slug={bundle.slug} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Buy this pack to install every component in one command.
                </p>
              )}

              {!owned && !bundle.isFree && (
                <Button className="w-full" onClick={claim} disabled={claiming}>
                  {claiming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4" />
                  )}
                  Get the bundle
                </Button>
              )}

              {error && <p className="text-xs text-destructive">{error}</p>}

              {claimed && !bundle.isFree && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Check className="h-3.5 w-3.5" />
                  Added to your library.
                </p>
              )}
            </div>
          </div>

          {components.length > 0 && (
            <div className="rounded-xl border">
              <div className="border-b px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Install individually
              </div>
              <div className="space-y-1.5 p-3">
                {components.map((component) => (
                  <Link
                    key={component.slug}
                    href={`/c/${component.slug}`}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition hover:bg-muted"
                  >
                    <span className="truncate">{component.title}</span>
                    <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function InstallCommand({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const command = `npx shadcn@latest add ${typeof window !== "undefined" ? window.location.origin : ""}/r/bundle/${slug}`;

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        shadcn CLI
      </p>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
        <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs">{command}</code>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(command);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            } catch {}
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function BundleComponentCard({
  component,
  locked,
}: {
  component: PresentedComponent;
  locked: boolean;
}) {
  return (
    <article className="group overflow-hidden rounded-xl border">
      <Link href={`/c/${component.slug}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted/40">
          {component.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={component.thumbnailUrl}
              alt={component.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Package className="h-5 w-5" />
            </div>
          )}

          {locked && (
            <span className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
              <span className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-[11px] font-medium">
                <Lock className="h-3.5 w-3.5" />
                Locked
              </span>
            </span>
          )}
        </div>

        <div className="p-3">
          <p className="truncate text-sm font-medium">{component.title}</p>
          {component.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {component.description}
            </p>
          )}
        </div>
      </Link>
    </article>
  );
}
