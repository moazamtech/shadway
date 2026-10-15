"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fromCents } from "@/components/marketplace/bundle-card";
import type { PresentedComponent, PresentedPlan } from "@/lib/bundles/present";

type Option = { slug: string; title: string; thumbnailUrl?: string };

/**
 * Author-only management for a bundle: visibility, curation and pricing.
 *
 * All three are backed by endpoints that were previously unreachable from the
 * UI, which is the gap that made 21st's bundles unmanageable without a DBA.
 */
export function BundleManage({
  slug,
  isPublic,
  plans,
  components,
}: {
  slug: string;
  isPublic: boolean;
  plans: PresentedPlan[];
  components: PresentedComponent[];
}) {
  const router = useRouter();

  const [published, setPublished] = useState(isPublic);
  const [included, setIncluded] = useState<string[]>(components.map((c) => c.slug));
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);

  const [priceCents, setPriceCents] = useState(plans[0]?.price ?? 0);
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/components?sort=latest&limit=60", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (cancelled) return;
        setOptions(
          (Array.isArray(data.items) ? data.items : []).map(
            (item: { slug: string; title: string; thumbnailUrl?: string }) => ({
              slug: item.slug,
              title: item.title,
              thumbnailUrl: item.thumbnailUrl,
            })
          )
        );
      })
      .catch(() => {})
      .finally(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const available = useMemo(
    () => options.filter((option) => !included.includes(option.slug)),
    [options, included]
  );

  /** Curate, then refresh so the server-rendered list stays authoritative. */
  const mutate = useCallback(
    async (componentSlug: string, action: "add" | "remove") => {
      setPending(componentSlug);
      setError(null);
      try {
        const response = await fetch(`/api/bundles/${slug}/items`, {
          method: action === "add" ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ componentSlug }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to update bundle");
        setIncluded(data.componentSlugs ?? []);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update bundle");
      } finally {
        setPending(null);
      }
    },
    [slug, router]
  );

  async function toggleVisibility() {
    setError(null);
    const next = !published;
    try {
      const response = await fetch(`/api/bundles/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update visibility");
      setPublished(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update visibility");
    }
  }

  async function savePlan() {
    setSavingPlan(true);
    setError(null);
    try {
      const response = await fetch(`/api/bundles/${slug}/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "individual",
          description: "Single developer",
          price: priceCents,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save price");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save price");
    } finally {
      setSavingPlan(false);
    }
  }

  return (
    <div className="rounded-xl border">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Manage
        </span>
        <Badge variant={published ? "secondary" : "outline"}>
          {published ? "Published" : "Draft"}
        </Badge>
      </div>

      <div className="space-y-4 p-4">
        <Button variant="outline" size="sm" className="w-full" onClick={toggleVisibility}>
          {published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {published ? "Make private" : "Publish bundle"}
        </Button>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium">
              Components ({included.length})
            </span>
            <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>

          <ul className="space-y-1">
            {components.map((component) => (
              <li
                key={component.slug}
                className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2 py-1.5 text-xs"
              >
                <span className="truncate">{component.title}</span>
                <button
                  type="button"
                  title="Remove from bundle"
                  disabled={pending === component.slug}
                  onClick={() => mutate(component.slug, "remove")}
                  className="text-muted-foreground transition hover:text-destructive"
                >
                  {pending === component.slug ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </button>
              </li>
            ))}
            {!components.length && (
              <li className="rounded-lg border border-dashed px-2 py-3 text-center text-xs text-muted-foreground">
                No components yet
              </li>
            )}
          </ul>

          {open && (
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1">
              {available.map((option) => (
                <li key={option.slug}>
                  <button
                    type="button"
                    disabled={pending === option.slug}
                    onClick={() => mutate(option.slug, "add")}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition hover:bg-muted"
                  >
                    {pending === option.slug ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="truncate">{option.title}</span>
                  </button>
                </li>
              ))}
              {!available.length && (
                <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                  Every component is already in this bundle.
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="space-y-1.5 border-t pt-3">
          <label className="text-xs font-medium" htmlFor="bundle-price">
            Price (USD)
          </label>
          <div className="flex gap-2">
            <input
              id="bundle-price"
              type="number"
              min={0}
              step="1"
              value={priceCents / 100}
              onChange={(event) =>
                setPriceCents(Math.max(0, Math.round(Number(event.target.value) * 100)))
              }
              className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
            />
            <Button size="sm" onClick={savePlan} disabled={savingPlan}>
              {savingPlan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Set to 0 to give the pack away. Currently {fromCents(priceCents)}.
          </p>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
