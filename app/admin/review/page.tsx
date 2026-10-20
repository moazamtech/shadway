"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminLayout } from "../components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, Code2, Inbox, X } from "lucide-react";
import { toast } from "sonner";

/**
 * The component review queue.
 *
 * Everything a user submits for publishing lands here. An admin approves
 * (optionally as an unlisted link) or rejects it; nothing reaches the
 * marketplace without an admin decision.
 */
type ReviewItem = {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  author?: {
    userId?: string;
    username?: string;
    name?: string;
  };
  thumbnailUrl?: string;
  dependencies: string[];
  visibility: "public" | "unlisted" | "private";
  codeSize: number;
  hasDemo: boolean;
  fileCount: number;
  status: string;
  updatedAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Record<string, "public" | "unlisted">>({});
  const [rejectTarget, setRejectTarget] = useState<ReviewItem | null>(null);

  useEffect(() => {
    let cancelled = false;

    // The queue arrives after the first paint, so the request and the state
    // are read together: nothing lands once the page has gone, and the
    // badge counts the queue the moment the answer does.
    fetch("/api/admin/review", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load the review queue");
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Error loading review queue:", error);
        toast.error("Failed to load the review queue");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function decide(item: ReviewItem, action: "approve" | "reject") {
    setBusySlug(item.slug);
    try {
      const body: Record<string, unknown> = {
        status: action === "approve" ? "published" : "hidden",
      };
      if (action === "approve") {
        body.visibility = visibility[item.slug] ?? "public";
      }
      const response = await fetch(
        `/api/components/${encodeURIComponent(item.slug)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Action failed");
      }
      setItems((prev) => prev.filter((row) => row.slug !== item.slug));
      toast.success(
        action === "approve"
          ? `“${item.title}” is live (${(visibility[item.slug] ?? "public") === "public" ? "public" : "unlisted"})`
          : `“${item.title}” was rejected`
      );
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusySlug(null);
    }
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Review queue</h1>
            <p className="text-muted-foreground">
              Components users submitted for publishing. Nothing goes live
              without your call.
            </p>
          </div>
          <Badge variant="secondary" className="gap-1.5">
            <Inbox className="h-3 w-3" />
            {loading ? "…" : items.length}
          </Badge>
        </div>

        <div className="border rounded-md bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Component</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={5} className="py-8">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    The queue is clear — nothing waiting for review.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.slug}>
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
                              No preview
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{item.title}</div>
                          <Link
                            href={`/studio/${item.slug}`}
                            target="_blank"
                            className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            <Code2 className="h-3 w-3" />
                            /studio/{item.slug}
                          </Link>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.author?.name || item.author?.username || "Unknown"}
                      <br />
                      @{item.author?.username || "unknown"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <Badge variant="outline" className="mb-1">
                        {item.category}
                      </Badge>
                      <div>
                        {(item.codeSize / 1024).toFixed(1)} KB ·{" "}
                        {item.hasDemo ? "demo" : "auto demo"} · {item.fileCount} files
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(item.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                          value={visibility[item.slug] ?? "public"}
                          onChange={(event) =>
                            setVisibility((prev) => ({
                              ...prev,
                              [item.slug]: event.target.value as "public" | "unlisted",
                            }))
                          }
                          aria-label={`Visibility for ${item.title}`}
                        >
                          <option value="public">Public</option>
                          <option value="unlisted">Unlisted</option>
                        </select>
                        <Button
                          size="sm"
                          disabled={busySlug === item.slug}
                          onClick={() => void decide(item, "approve")}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busySlug === item.slug}
                          onClick={() => setRejectTarget(item)}
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <AlertDialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reject “{rejectTarget?.title}”?</AlertDialogTitle>
              <AlertDialogDescription>
                The component stays with its author as hidden — they can rework
                it and submit again. The author sees the status in their studio.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (rejectTarget) void decide(rejectTarget, "reject");
                  setRejectTarget(null);
                }}
              >
                <X className="h-3.5 w-3.5" />
                Reject
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
