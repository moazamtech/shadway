"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Plus, ArrowUpDown, RefreshCw } from "lucide-react";
import { Website, WebsiteFormData } from "@/lib/types";
import { AdminLayout } from "../components";
import {
  SearchFilter,
  WebsitesTable,
  WebsiteFormDialog,
  WebsiteReorderDialog,
} from "../dashboard/components";

interface WebsiteStats {
  totalSites: number;
  featuredSites: number;
  categoriesCount: number;
  recentlyAdded: number;
}

/**
 * The website list, as the API serves it.
 *
 * The request sits outside the component so the first paint and the refresh
 * button ask the same question and get the same answer: a list of websites or
 * a failure, never a page that is half loaded.
 */
async function loadWebsites(): Promise<Website[]> {
  const response = await fetch("/api/websites");
  if (!response.ok) {
    throw new Error("Failed to fetch websites");
  }
  return response.json();
}

export default function WebsitesPage() {
  // Core state
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // The moment the list arrived. A week is a moving target, and a render is
  // not allowed to read the clock: the same render has to produce the same
  // count however often it runs, or the tile flickers between two answers
  // nobody can explain. Measuring the window from the fetch keeps it still.
  const [fetchedAt, setFetchedAt] = useState(0);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState<Website | null>(null);
  const [isReorderDialogOpen, setIsReorderDialogOpen] = useState(false);

  // Filter and pagination state
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Computed stats
  const stats: WebsiteStats = useMemo(() => {
    const weekAgo = fetchedAt - 7 * 24 * 60 * 60 * 1000;
    const recentlyAdded = websites.filter((website) => {
      const addedDate = new Date(website.createdAt || fetchedAt).getTime();
      return addedDate > weekAgo;
    }).length;

    return {
      totalSites: websites.length,
      featuredSites: websites.filter((w) => w.featured).length,
      categoriesCount: new Set(websites.map((w) => w.category)).size,
      recentlyAdded,
    };
  }, [websites, fetchedAt]);

  useEffect(() => {
    let cancelled = false;

    // The list arrives after the first paint. Setting the state from the
    // promise keeps the two in step: nothing lands once the page has gone,
    // and the spinner ends when the answer does.
    loadWebsites()
      .then((data) => {
        if (cancelled) return;
        setFetchedAt(Date.now());
        setWebsites(data);
      })
      .catch((error) => {
        if (!cancelled) console.error("Error fetching websites:", error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchWebsites = async () => {
    try {
      setLoading(true);
      setWebsites(await loadWebsites());
    } catch (error) {
      console.error("Error fetching websites:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filtered and paginated websites
  const filteredWebsites = useMemo(() => {
    return websites
      .filter((website) => {
        const matchesSearch =
          website.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          website.description
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          website.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          website.tags?.some((tag) =>
            tag.toLowerCase().includes(searchTerm.toLowerCase())
          );

        const matchesCategory =
          !categoryFilter || website.category === categoryFilter;

        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  }, [websites, searchTerm, categoryFilter]);

  const paginatedWebsites = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredWebsites.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredWebsites, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredWebsites.length / itemsPerPage);
  const categories = useMemo(() => {
    return [...new Set(websites.map((w) => w.category))];
  }, [websites]);

  // Event handlers
  const handleSubmit = async (formData: WebsiteFormData) => {
    setSubmitting(true);
    try {
      const url = editingWebsite
        ? `/api/websites/${editingWebsite._id}`
        : "/api/websites";

      const method = editingWebsite ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to save website");
      }

      await fetchWebsites();
      setIsDialogOpen(false);
      setEditingWebsite(null);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error saving website:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (website: Website) => {
    setEditingWebsite(website);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this website?")) {
      return;
    }

    try {
      const response = await fetch(`/api/websites/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete website");
      }

      await fetchWebsites();
    } catch (error) {
      console.error("Error deleting website:", error);
    }
  };

  const handleAddNew = () => {
    setEditingWebsite(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingWebsite(null);
  };

  const handleReorder = async (websiteId: string, direction: "up" | "down") => {
    const website = websites.find((w) => w._id === websiteId);
    if (!website) return;

    const currentSequence = website.sequence || 0;
    const newSequence =
      direction === "up" ? currentSequence - 1 : currentSequence + 1;

    try {
      const response = await fetch(`/api/websites/${websiteId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...website,
          sequence: Math.max(0, newSequence),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update sequence");
      }

      await fetchWebsites();
    } catch (error) {
      console.error("Error updating sequence:", error);
    }
  };

  const handleBulkReorder = async (websiteIds: string[]) => {
    try {
      const response = await fetch("/api/websites/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ websiteIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to update website order");
      }

      await fetchWebsites();
    } catch (error) {
      console.error("Error updating website order:", error);
      throw error;
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading websites...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Websites</h1>
            <p className="text-muted-foreground">
              Manage your component library websites and monitor performance
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchWebsites} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button
              onClick={() => setIsReorderDialogOpen(true)}
              variant="outline"
              className="gap-2"
              disabled={websites.length < 2}
            >
              <ArrowUpDown className="w-4 h-4" />
              Reorder
            </Button>
            <Button onClick={handleAddNew} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Website
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Websites
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSites}</div>
              <p className="text-xs text-muted-foreground mt-1">Active sites</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Featured Sites
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.featuredSites}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {((stats.featuredSites / stats.totalSites) * 100 || 0).toFixed(
                  1
                )}
                % of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.categoriesCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Unique categories
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Recently Added
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentlyAdded}</div>
              <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader className="space-y-6">
            <SearchFilter
              searchTerm={searchTerm}
              categoryFilter={categoryFilter}
              categories={categories}
              onSearchChange={(value) => {
                setSearchTerm(value);
                setCurrentPage(1);
              }}
              onCategoryChange={(value) => {
                setCategoryFilter(value === "all" ? "" : value);
                setCurrentPage(1);
              }}
              onClear={() => {
                setSearchTerm("");
                setCategoryFilter("");
                setCurrentPage(1);
              }}
            />

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>
                Showing{" "}
                {filteredWebsites.length === 0
                  ? 0
                  : (currentPage - 1) * itemsPerPage + 1}{" "}
                to{" "}
                {Math.min(currentPage * itemsPerPage, filteredWebsites.length)}{" "}
                of {filteredWebsites.length} websites
                {searchTerm && (
                  <span className="ml-2 text-primary">
                    (filtered from {websites.length} total)
                  </span>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <WebsitesTable
              websites={paginatedWebsites}
              currentPage={currentPage}
              totalPages={totalPages}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onPageChange={setCurrentPage}
              onReorder={handleReorder}
            />
          </CardContent>
        </Card>
      </div>

      <WebsiteFormDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        website={editingWebsite}
        isLoading={submitting}
      />

      <WebsiteReorderDialog
        isOpen={isReorderDialogOpen}
        onClose={() => setIsReorderDialogOpen(false)}
        websites={websites}
        onReorder={handleBulkReorder}
      />
    </AdminLayout>
  );
}
