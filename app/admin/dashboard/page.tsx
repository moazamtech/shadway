'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus } from 'lucide-react';
import { Website } from '@/lib/types';
import {
  AdminHeader,
  StatsCards,
  SearchFilter,
  WebsitesTable,
  WebsiteFormDialog
} from './components';

interface DashboardStats {
  totalSites: number;
  featuredSites: number;
  categoriesCount: number;
  recentlyAdded: number;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Core state
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState<Website | null>(null);

  // Filter and pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Computed stats
  const stats: DashboardStats = useMemo(() => {
    const recentlyAdded = websites.filter(website => {
      const addedDate = new Date(website.createdAt || Date.now());
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return addedDate > weekAgo;
    }).length;

    return {
      totalSites: websites.length,
      featuredSites: websites.filter(w => w.featured).length,
      categoriesCount: new Set(websites.map(w => w.category)).size,
      recentlyAdded
    };
  }, [websites]);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session || session.user.role !== 'admin') {
      router.push('/admin/login');
      return;
    }

    fetchWebsites();
  }, [session, status, router]);

  const fetchWebsites = async () => {
    try {
      const response = await fetch('/api/websites');
      if (!response.ok) {
        throw new Error('Failed to fetch websites');
      }
      const data = await response.json();
      setWebsites(data);
    } catch (error) {
      console.error('Error fetching websites:', error);
      // TODO: Add proper error handling/toast notification
    } finally {
      setLoading(false);
    }
  };

  // Filtered and paginated websites
  const filteredWebsites = useMemo(() => {
    return websites
      .filter(website => {
        const matchesSearch = website.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            website.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            website.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            website.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesCategory = !categoryFilter || website.category === categoryFilter;

        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0)); // Sort by sequence
  }, [websites, searchTerm, categoryFilter]);

  const paginatedWebsites = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredWebsites.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredWebsites, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredWebsites.length / itemsPerPage);
  const categories = useMemo(() => {
    return [...new Set(websites.map(w => w.category))];
  }, [websites]);

  // Event handlers
  const handleSubmit = async (formData: any) => {
    setSubmitting(true);
    try {
      const url = editingWebsite
        ? `/api/websites/${editingWebsite._id}`
        : '/api/websites';

      const method = editingWebsite ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to save website');
      }

      await fetchWebsites();
      setIsDialogOpen(false);
      setEditingWebsite(null);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error saving website:', error);
      // TODO: Add proper error handling/toast notification
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (website: Website) => {
    setEditingWebsite(website);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this website?')) {
      return;
    }

    try {
      const response = await fetch(`/api/websites/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete website');
      }

      await fetchWebsites();
    } catch (error) {
      console.error('Error deleting website:', error);
      // TODO: Add proper error handling/toast notification
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

  const handleReorder = async (websiteId: string, direction: 'up' | 'down') => {
    const website = websites.find(w => w._id === websiteId);
    if (!website) return;

    const currentSequence = website.sequence || 0;
    const newSequence = direction === 'up' ? currentSequence - 1 : currentSequence + 1;

    try {
      const response = await fetch(`/api/websites/${websiteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...website,
          sequence: Math.max(0, newSequence) // Ensure sequence doesn't go below 0
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update sequence');
      }

      await fetchWebsites();
    } catch (error) {
      console.error('Error updating sequence:', error);
    }
  };

  // Loading state
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Authentication check
  if (!session || session.user.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader userName={session.user?.name} />

      <main className="container mx-auto px-4 py-8 space-y-8">
        <StatsCards stats={stats} />

        <Card>
          <CardHeader className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  Website Management
                </CardTitle>
                <CardDescription>
                  Manage your component library websites and monitor performance
                </CardDescription>
              </div>

              <Button onClick={handleAddNew} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Website
              </Button>
            </div>

            <SearchFilter
              searchTerm={searchTerm}
              categoryFilter={categoryFilter}
              categories={categories}
              onSearchChange={(value) => {
                setSearchTerm(value);
                setCurrentPage(1);
              }}
              onCategoryChange={(value) => {
                setCategoryFilter(value === 'all' ? '' : value);
                setCurrentPage(1);
              }}
              onClear={() => {
                setSearchTerm('');
                setCategoryFilter('');
                setCurrentPage(1);
              }}
            />

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>
                Showing{' '}
                {filteredWebsites.length === 0
                  ? 0
                  : (currentPage - 1) * itemsPerPage + 1
                } to{' '}
                {Math.min(currentPage * itemsPerPage, filteredWebsites.length)} of{' '}
                {filteredWebsites.length} websites
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
      </main>

      <WebsiteFormDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        website={editingWebsite}
        isLoading={submitting}
      />
    </div>
  );
}