"use client";

import Link from "next/link";
import { Check, Copy, Layers, Lock, Package, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PresentedBundle } from "@/lib/bundles/present";

export type BundlePreview = {
  slug: string;
  title: string;
  thumbnailUrl?: string;
  videoUrl?: string;
};

export type BundleCardItem = PresentedBundle & { previews: BundlePreview[] };

/**
 * A curated pack of components.
 *
 * 21st renders bundles as a full-width horizontal slider; here the strip of
 * component covers lives inside a card so a bundle sits naturally alongside
 * the single components in the feed.
 */
export function BundleCard({ bundle }: { bundle: BundleCardItem }) {
  const owned = bundle.purchase?.status === "paid" || bundle.isFree;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border bg-background transition hover:border-foreground/20">
      <Link
        href={`/bundles/${bundle.slug}`}
        className="relative block border-b bg-muted/40"
        aria-label={bundle.name}
      >
        {bundle.previews.length ? (
          <div className="flex snap-x snap-mandatory gap-px overflow-x-auto">
            {bundle.previews.map((preview) => (
              <div
                key={preview.slug}
                className="relative aspect-[4/3] w-40 shrink-0 snap-start overflow-hidden bg-muted sm:w-44"
              >
                {preview.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview.thumbnailUrl}
                    alt={preview.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Layers className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex aspect-[16/5] w-full items-center justify-center text-muted-foreground">
            <Layers className="h-6 w-6" />
          </div>
        )}

        <div className="absolute left-2 top-2 flex gap-1.5">
          <Badge variant="secondary" className="gap-1 bg-background/90 backdrop-blur">
            <Package className="h-3 w-3" />
            {bundle.componentSlugs.length}{" "}
            {bundle.componentSlugs.length === 1 ? "component" : "components"}
          </Badge>
          {!bundle.isFree && (
            <Badge className="gap-1 bg-background/90 backdrop-blur">
              {owned ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {fromCents(bundle.plans[0]?.price)}
            </Badge>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/bundles/${bundle.slug}`}
              className="block truncate text-sm font-semibold tracking-tight hover:underline"
            >
              {bundle.name}
            </Link>
            <Link
              href={`/u/${bundle.author.username}`}
              className="block truncate text-xs text-muted-foreground hover:underline"
            >
              @{bundle.author.username}
            </Link>
          </div>

          {bundle.isFree && <CopyInstallButton slug={bundle.slug} />}
        </div>

        {bundle.description && (
          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
            {bundle.description}
          </p>
        )}

        <div className="mt-auto flex items-center gap-1.5">
          {bundle.featured && (
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              Featured
            </Badge>
          )}
          {!bundle.isPublic && (
            <Badge variant="outline" className="text-[10px]">
              Private draft
            </Badge>
          )}
        </div>
      </div>
    </article>
  );
}

function CopyInstallButton({ slug }: { slug: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="shrink-0"
      onClick={async (event) => {
        event.preventDefault();
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        try {
          await navigator.clipboard.writeText(
            `npx shadcn@latest add ${origin}/r/bundle/${slug}`
          );
        } catch {}
      }}
      title="Copy one-command install"
    >
      <Copy className="h-3.5 w-3.5" />
      Install
    </Button>
  );
}

/** Prices are stored in cents; free bundles never reach this. */
export function fromCents(cents?: number): string {
  if (cents == null) return "—";
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
