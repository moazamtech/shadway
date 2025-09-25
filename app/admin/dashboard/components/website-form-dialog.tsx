import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { Website } from '@/lib/types';
import { fetchSiteMetadata } from '@/lib/metadata-fetcher';

interface WebsiteFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  website?: Website | null;
  isLoading?: boolean;
}

export function WebsiteFormDialog({
  isOpen,
  onClose,
  onSubmit,
  website,
  isLoading = false
}: WebsiteFormDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    url: '',
    image: '',
    category: '',
    tags: '',
    featured: false,
    sequence: 0,
  });
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);

  // Update form data when website prop changes
  useEffect(() => {
    if (website) {
      setFormData({
        name: website.name || '',
        description: website.description || '',
        url: website.url || '',
        image: website.image || '',
        category: website.category || '',
        tags: website.tags?.join(', ') || '',
        featured: website.featured || false,
        sequence: website.sequence || 0,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        url: '',
        image: '',
        category: '',
        tags: '',
        featured: false,
        sequence: 0,
      });
    }
  }, [website]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const websiteData = {
      ...formData,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
    };

    await onSubmit(websiteData);
  };

  const handleFetchMetadata = async () => {
    if (!formData.url) {
      return;
    }

    setIsFetchingMetadata(true);
    try {
      const metadata = await fetchSiteMetadata(formData.url);
      setFormData(prev => ({
        ...prev,
        name: metadata.title || prev.name,
        description: metadata.description || prev.description,
        image: metadata.ogImage || prev.image,
      }));
    } catch (error) {
      console.error('Failed to fetch metadata:', error);
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {website ? 'Edit Website' : 'Add New Website'}
          </DialogTitle>
          <DialogDescription>
            {website
              ? 'Update the website information below.'
              : 'Fill in the details to add a new website to your collection.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Enter website name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                placeholder="e.g., UI Library, Framework"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sequence">Display Order</Label>
              <Input
                id="sequence"
                type="number"
                min="0"
                max="9999"
                value={formData.sequence}
                onChange={(e) => setFormData({...formData, sequence: parseInt(e.target.value) || 0})}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers appear first (0 = highest priority)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({...formData, tags: e.target.value})}
                placeholder="react, typescript, ui-components"
              />
              <p className="text-xs text-muted-foreground">
                Separate tags with commas
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Describe what makes this website special..."
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Website URL</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({...formData, url: e.target.value})}
                placeholder="https://example.com"
                className="flex-1"
                required
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleFetchMetadata}
                disabled={isFetchingMetadata || !formData.url}
                className="shrink-0"
              >
                {isFetchingMetadata ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Auto-fetch'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use auto-fetch to automatically fill in the name, description, and image
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Image URL</Label>
            <Input
              id="image"
              type="url"
              value={formData.image}
              onChange={(e) => setFormData({...formData, image: e.target.value})}
              placeholder="https://example.com/image.jpg"
              required
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="featured"
              checked={formData.featured}
              onCheckedChange={(checked) => setFormData({...formData, featured: checked})}
            />
            <Label htmlFor="featured" className="text-sm font-medium">
              Mark as featured website
            </Label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {website ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                website ? 'Update Website' : 'Create Website'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}