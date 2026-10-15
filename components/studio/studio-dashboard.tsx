"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Eye,
  Heart,
  Loader2,
  Plus,
  Trash2,
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
  status: "draft" | "published" | "hidden" | "flagged";
  visibility: "public" | "unlisted" | "private";
  views: number;
  likes: number;
  installs: number;
  updatedAt: string;
  thumbnailUrl?: string;
};

const STATUS_STYLES: Record<StudioItem["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-primary/10 text-primary",
  hidden: "bg-destructive/10 text-destructive",
  flagged: "bg-destructive/10 text-destructive",
};

const STATUS_LABELS: Record<StudioItem["status"], string> = {
  draft: "Draft",
  published: "Published",
  hidden: "Hidden",
  flagged: "Flagged",
};

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
  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<StudioItem | null>(null);
  const [deletingBusy, setDeletingBusy] = React.useState(false);
  const [rows, setRows] = React.useState(items);

  React.useEffect(() => {
    setRows(items);
  }, [items]);

  const drafts = rows.filter((item) => item.status === "draft").length;
  const published = rows.filter((item) => item.status === "published").length;

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
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Components</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage the components you publish to Shadway.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Create
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{drafts} draft{drafts === 1 ? "" : "s"}</span>
        <span className="text-border">·</span>
        <span>{published} published</span>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[45%]">Component</TableHead>
              <TableHead className="w-[110px]">Status</TableHead>
              <TableHead className="w-[110px]">Visibility</TableHead>
              <TableHead className="w-[120px]">Updated</TableHead>
              <TableHead className="w-[90px] text-right">Views</TableHead>
              <TableHead className="w-[90px] text-right">Likes</TableHead>
              <TableHead className="w-[90px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((item) => (
                <TableRow
                  key={item.slug}
                  className="cursor-pointer"
                  onClick={() => router.push(`/studio/${item.slug}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md border bg-muted">
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
                        "rounded px-2 py-1 text-[11px] font-medium",
                        STATUS_STYLES[item.status]
                      )}
                    >
                      {STATUS_LABELS[item.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.status === "draft"
                      ? "Private"
                      : item.visibility === "public"
                        ? "Public"
                        : "Unlisted"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(item.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {formatCount(item.views)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {formatCount(item.likes)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {item.status === "published" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Open component page"
                          asChild
                        >
                          <Link href={`/c/${item.slug}`}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Delete project"
                        onClick={() => setDeleting(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <p className="text-sm font-medium">No components yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create your first component — it stays a private draft until you publish it.
                  </p>
                  <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Create component
                  </Button>
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
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
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
            <DialogTitle>Delete “{deleting?.title}”?</DialogTitle>
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
