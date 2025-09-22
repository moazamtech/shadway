'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Filter, Loader2 } from 'lucide-react';
import { Template } from '@/lib/types';
import { TemplatesTable } from '../dashboard/components/templates-table';
import { TemplateFormDialog } from '../dashboard/components/template-form-dialog';
import { AdminLayout } from '../components/admin-layout';
import { toast } from 'sonner';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      } else {
        toast.error('Failed to fetch templates');
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Error fetching templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (formData: any) => {
    setFormLoading(true);
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchTemplates();
        setIsFormOpen(false);
        toast.success('Template created successfully');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create template');
      }
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Error creating template');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditTemplate = async (formData: any) => {
    if (!editingTemplate?._id) return;

    setFormLoading(true);
    try {
      const response = await fetch(`/api/templates/${editingTemplate._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchTemplates();
        setIsFormOpen(false);
        setEditingTemplate(null);
        toast.success('Template updated successfully');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update template');
      }
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Error updating template');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchTemplates();
        toast.success('Template deleted successfully');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete template');
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Error deleting template');
    }
  };

  const openEditDialog = (template: Template) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
  };

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setIsFormOpen(true);
  };

  const closeDialog = () => {
    setIsFormOpen(false);
    setEditingTemplate(null);
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
            <p className="text-muted-foreground">
              Manage website templates and their details
            </p>
          </div>
          <Button onClick={openCreateDialog} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Template
          </Button>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-2xl font-bold">{templates.length}</div>
            <div className="text-sm text-muted-foreground">Total Templates</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-2xl font-bold">{templates.filter(t => t.featured).length}</div>
            <div className="text-sm text-muted-foreground">Featured</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-2xl font-bold">{templates.filter(t => {
              const price = typeof t.price === 'object' ? (t.price as any).amount : t.price;
              return price === 0;
            }).length}</div>
            <div className="text-sm text-muted-foreground">Free Templates</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-2xl font-bold">{templates.filter(t => {
              const price = typeof t.price === 'object' ? (t.price as any).amount : t.price;
              return price > 0;
            }).length}</div>
            <div className="text-sm text-muted-foreground">Paid Templates</div>
          </div>
        </div>

        {/* Templates Table */}
        <TemplatesTable
          templates={filteredTemplates}
          onEdit={openEditDialog}
          onDelete={handleDeleteTemplate}
        />

        {/* Form Dialog */}
        <TemplateFormDialog
          isOpen={isFormOpen}
          onClose={closeDialog}
          onSubmit={editingTemplate ? handleEditTemplate : handleCreateTemplate}
          template={editingTemplate}
          isLoading={formLoading}
        />
      </div>
    </AdminLayout>
  );
}