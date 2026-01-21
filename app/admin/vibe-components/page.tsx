"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../components/admin-layout";
import { VibecodeComponent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function VibeComponentsPage() {
  const [items, setItems] = useState<VibecodeComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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

  const handleDelete = async (slug?: string) => {
    if (!slug) return;
    const confirmed = window.confirm(
      "Delete this vibecode component? This cannot be undone.",
    );
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/vibecode/${slug}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setItems((prev) => prev.filter((item) => item.slug !== slug));
        toast.success("Vibecode component deleted");
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData?.error || "Failed to delete component");
      }
    } catch (error) {
      console.error("Error deleting vibecode component:", error);
      toast.error("Error deleting component");
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Vibe Components
            </h1>
            <p className="text-muted-foreground">
              Manage published vibecode components
            </p>
          </div>
          <div className="rounded-lg border bg-card px-3 py-2 text-sm">
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

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              No vibecode components found.
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item._id || item.slug}
                className="rounded-xl border bg-card p-4 flex flex-col gap-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">{item.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      /vibecode/{item.slug}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(item.slug)}
                    className="sm:self-start"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.category && (
                    <Badge variant="secondary">{item.category}</Badge>
                  )}
                  {item.tags?.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                  {item.publishedAt && (
                    <span className="text-xs text-muted-foreground">
                      Published{" "}
                      {new Date(item.publishedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
