"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  ExternalLink,
  Eye,
  Heart,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type StudioItem = {
  slug: string;
  title: string;
  status: "draft" | "pending" | "published" | "hidden" | "flagged";
  visibility: "public" | "unlisted" | "private";
  views: number;
  likes: number;
  installs: number;
  updatedAt: string;
  thumbnailUrl?: string;
};

const STATUS_STYLES: Record<StudioItem["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-amber-500/10 text-amber-600",
  published: "bg-primary/10 text-primary",
  hidden: "bg-destructive/10 text-destructive",
  flagged: "bg-destructive/10 text-destructive",
};

const STATUS_LABELS: Record<StudioItem["status"], string> = {
  draft: "Draft",
  pending: "In review",
  published: "Published",
  hidden: "Hidden",
  flagged: "Flagged",
};

type Filter = "all" | "draft" | "pending" | "published";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "pending", label: "In review" },
  { id: "published", label: "Published" },
];

/** The segmented control used for the status filter. */
const SEGMENT =
  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

/**
 * The studio home: every project this account owns, drafts included.
 *
 * Clicking a row opens the project in the editor; drafts stay invisible to
 * the marketplace until they are published from there.
 */
export function StudioDashboard({ items }: { items: StudioItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submittedVisible, setSubmittedVisible] = React.useState(
    searchParams.get("submitted") === "1"
  );
  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<StudioItem | null>(null);
  const [deletingBusy, setDeletingBusy] = React.useState(false);
  const [rows, setRows] = React.useState(items);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    setRows(items);
  }, [items]);

  const counts: Record<Filter, number> = {
    all: rows.length,
    draft: rows.filter((item) => item.status === "draft").length,
    pending: rows.filter((item) => item.status === "pending").length,
    published: rows.filter((item) => item.status === "published").length,
  };

  const needle = query.trim().toLowerCase();
  const visible = rows.filter((item) => {
    if (filter !== "all" && item.status !== filter) return false;
    if (!needle) return true;
    return `${item.title} ${item.slug}`.toLowerCase().includes(needle);
  });

  async function createDraft() {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/components/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: name.trim() || "Untitled component" }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login?callbackUrl=/studio");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Failed to create the project");
      router.push(`/studio/${data.item.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create the project");
      setCreating(false);
    }
  }

  async function deleteItem() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      const response = await fetch(`/api/components/${deleting.slug}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete the project");
      }
      setRows((prev) => prev.filter((item) => item.slug !== deleting.slug));
      setDeleting(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete the project");
    } finally {
      setDeletingBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Components</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage the components you publish to Shadway.
          </p>
        </div>
        <Button size="sm" className="h-8 gap-1.5 rounded-lg px-3 text-[12px]" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Create
        </Button>
      </div>

      {submittedVisible ? (
        <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Submitted for review</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Review usually takes 24 hours. Once an admin approves it, the row turns
              &ldquo;Published&rdquo; and goes live — you can preview it before then by opening
              the component page.
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setSubmittedVisible(false)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* Toolbar — the status filter and search, both scoped to the table. */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
              className={cn(
                SEGMENT,
                filter === option.id
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
              <span className="text-[10px] tabular-nums opacity-60">{counts[option.id]}</span>
            </button>
          ))}
        </div>

        <div className="relative ml-auto">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search components"
            className="h-8 w-full rounded-lg border border-border/60 bg-background pr-3 pl-8 text-xs outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 sm:w-56"
          />
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[42%]">Component</TableHead>
              <TableHead className="w-[110px]">Status</TableHead>
              <TableHead className="hidden w-[110px] sm:table-cell">Visibility</TableHead>
              <TableHead className="hidden w-[120px] md:table-cell">Updated</TableHead>
              <TableHead className="w-[80px] text-right">Views</TableHead>
              <TableHead className="hidden w-[80px] text-right sm:table-cell">Likes</TableHead>
              <TableHead className="w-[90px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length ? (
              visible.map((item) => (
                <TableRow
                  key={item.slug}
                  className="cursor-pointer"
                  onClick={() => router.push(`/studio/${item.slug}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted">
                        {item.thumbnailUrl ? (
                          <span
                            className="block h-full w-full bg-cover bg-center"
                            style={{ backgroundImage: `url(${item.thumbnailUrl})` }}
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                            {item.status === "draft" ? "Draft" : "No preview"}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{item.title}</div>
                        <div className="truncate font-mono text-[11px] text-muted-foreground">
                          /c/{item.slug}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-block rounded-md px-2 py-1 text-[11px] font-medium",
                        STATUS_STYLES[item.status]
                      )}
                    >
                      {STATUS_LABELS[item.status]}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {item.status === "draft"
                      ? "Private"
                      : item.status === "pending"
                        ? "On approval"
                        : item.visibility === "public"
                          ? "Public"
                          : "Unlisted"}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                    {formatDate(item.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                    {formatCount(item.views)}
                  </TableCell>
                  <TableCell className="hidden text-right text-xs text-muted-foreground tabular-nums sm:table-cell">
                    {formatCount(item.likes)}
                  </TableCell>
                  <TableCell>
                    <div
                      className="flex items-center justify-end gap-0.5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {/* The page at /c/<slug> renders for the owner even
                          while the component is in review, so the preview
                          link is always offered. */}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
                        title="Open component page"
                        asChild
                      >
                        <Link href={`/c/${item.slug}`}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 rounded-md text-muted-foreground hover:text-destructive"
                        title="Delete project"
                        onClick={() => setDeleting(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="p-0">
                  <div className="flex flex-col items-center px-6 py-14 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                      <Package className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <p className="mt-4 text-sm font-medium">
                      {rows.length ? "Nothing matches" : "No components yet"}
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                      {rows.length
                        ? "Try a different filter or search term."
                        : "Create your first component — it stays a private draft until you publish it."}
                    </p>
                    {!rows.length ? (
                      <Button
                        size="sm"
                        className="mt-5 h-8 gap-1.5 rounded-lg px-3 text-[12px]"
                        onClick={() => setCreateOpen(true)}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        Create component
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={(open) => !creating && setCreateOpen(open)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Create component</DialogTitle>
            <DialogDescription>
              Starts a new private draft with the full shadcn/ui folder available.
            </DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !creating) void createDraft();
            }}
            placeholder="Animated gradient button"
            className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={creating} onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={creating} onClick={() => void createDraft()}>
              {creating && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{deleting?.title}&rdquo;?</DialogTitle>
            <DialogDescription>
              {deleting?.status === "published"
                ? "The component page and its registry item stop working immediately."
                : "This draft and its code are removed permanently."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={deletingBusy} onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deletingBusy}
              onClick={() => void deleteItem()}
            >
              {deletingBusy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
