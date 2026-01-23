"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminLayout } from "../components/admin-layout";
import { VibecodeComponent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Search, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

type EditValues = {
  title: string;
  description: string;
  category: string;
  tags: string;
};

export default function VibeComponentsPage() {
  const [items, setItems] = useState<VibecodeComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingItem, setEditingItem] = useState<VibecodeComponent | null>(
    null,
  );
  const [editValues, setEditValues] = useState<EditValues>({
    title: "",
    description: "",
    category: "",
    tags: "",
  });
  const [editError, setEditError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<VibecodeComponent | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await fetch("/api/vibecode");
      if (response.ok) {
        const data = await response.json();
        setItems(Array.isArray(data) ? data : []);
      } else {
        toast.error("Failed to fetch vibecode components");
      }
    } catch (error) {
      console.error("Error fetching vibecode components:", error);
      toast.error("Error fetching vibecode components");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => {
      const haystack = [
        item.title,
        item.description,
        item.slug,
        item.category,
        ...(item.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [items, searchTerm]);
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const handleDelete = async (slug?: string) => {
    if (!slug) return;

    try {
      const response = await fetch(`/api/vibecode/${slug}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setItems((prev) => prev.filter((item) => item.slug !== slug));
        toast.success("Vibecode component deleted");
        setDeleteError("");
        setDeleteTarget(null);
        return true;
      } else {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData?.error || "Failed to delete component";
        setDeleteError(message);
        toast.error(message);
        return false;
      }
    } catch (error) {
      console.error("Error deleting vibecode component:", error);
      setDeleteError("Error deleting component");
      toast.error("Error deleting component");
      return false;
    }
  };

  const openEdit = (item: VibecodeComponent) => {
    setEditingItem(item);
    setEditError("");
    setEditValues({
      title: item.title || "",
      description: item.description || "",
      category: item.category || "",
      tags: item.tags?.join(", ") || "",
    });
  };

  const handleEditSave = async () => {
    if (!editingItem?.slug) return;
    if (!editValues.title.trim() || !editValues.description.trim()) {
      setEditError("Title and description are required.");
      toast.error("Title and description are required");
      return;
    }

    const payload = {
      title: editValues.title.trim(),
      description: editValues.description.trim(),
      category: editValues.category.trim() || undefined,
      tags: editValues.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    try {
      const response = await fetch(`/api/vibecode/${editingItem.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData?.error || "Failed to update component";
        setEditError(message);
        toast.error(message);
        return;
      }

      const updated = await response.json();
      setItems((prev) =>
        prev.map((item) =>
          item.slug === editingItem.slug ? { ...item, ...updated } : item,
        ),
      );
      toast.success("Vibecode component updated");
      setEditError("");
      setEditingItem(null);
    } catch (error) {
      console.error("Error updating vibecode component:", error);
      setEditError("Error updating component");
      toast.error("Error updating component");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-balance">
              Vibe Components
            </h1>
            <p className="text-muted-foreground text-pretty">
              Manage published vibecode components
            </p>
          </div>
          <div className="rounded-lg border bg-card px-3 py-2 text-sm tabular-nums">
            {items.length} total
          </div>
        </div>

        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by title, tag, or slug..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="border rounded-xl bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thumbnail</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    <TableCell>
                      <Skeleton className="size-12 rounded-md" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-72" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-8 w-20" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-10 text-sm text-muted-foreground"
                  >
                    No vibecode components found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item._id || item.slug}>
                    <TableCell>
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={`${item.title} thumbnail`}
                          className="size-12 rounded-md border object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="size-12 rounded-md border bg-muted/50" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{item.title}</div>
                        <p className="text-sm text-muted-foreground text-pretty">
                          {item.description}
                        </p>
                        <Link
                          href={`/vibecode/${item.slug}`}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          /vibecode/{item.slug}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.category ? (
                        <Badge variant="secondary">{item.category}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.tags?.length ? (
                          item.tags.map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-sm text-muted-foreground">
                      {item.publishedAt
                        ? new Date(item.publishedAt).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setDeleteError("");
                            setDeleteTarget(item);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={!!editingItem}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null);
            setEditError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-balance">
              Edit vibecode component
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-title">
                Title
              </label>
              <Input
                id="edit-title"
                value={editValues.title}
                onChange={(e) =>
                  setEditValues((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-description">
                Description
              </label>
              <Textarea
                id="edit-description"
                value={editValues.description}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-category">
                Category
              </label>
              <select
                id="edit-category"
                value={editValues.category}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    category: e.target.value,
                  }))
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-tags">
                Tags
              </label>
              <Input
                id="edit-tags"
                value={editValues.tags}
                onChange={(e) =>
                  setEditValues((prev) => ({ ...prev, tags: e.target.value }))
                }
                placeholder="comma, separated, tags"
              />
            </div>
            {editError ? (
              <p className="text-sm text-destructive" aria-live="polite">
                {editError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-balance">
              Delete vibecode component?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-pretty">
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.title}
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
            {deleteError ? (
              <p className="text-sm text-destructive" aria-live="polite">
                {deleteError}
              </p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(deleteTarget?.slug)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
