import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GripVertical, Loader2, Save, X, Search } from 'lucide-react';
import { Website } from '@/lib/types';
import Image from 'next/image';

interface WebsiteReorderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  websites: Website[];
  onReorder: (websiteIds: string[]) => Promise<void>;
}

export function WebsiteReorderDialog({
  isOpen,
  onClose,
  websites,
  onReorder
}: WebsiteReorderDialogProps) {
  const [reorderedWebsites, setReorderedWebsites] = useState(websites);
  const [isLoading, setIsLoading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Reset when dialog opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setReorderedWebsites([...websites].sort((a, b) => (a.sequence || 0) - (b.sequence || 0)));
      setSearchTerm('');
    }
  }, [isOpen, websites]);

  // Filter websites based on search term
  const filteredWebsites = React.useMemo(() => {
    if (!searchTerm.trim()) return reorderedWebsites;

    return reorderedWebsites.filter(website =>
      website.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      website.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      website.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [reorderedWebsites, searchTerm]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newWebsites = [...reorderedWebsites];
    const draggedWebsite = newWebsites[draggedIndex];

    // Remove dragged item
    newWebsites.splice(draggedIndex, 1);

    // Insert at new position
    newWebsites.splice(dropIndex, 0, draggedWebsite);

    setReorderedWebsites(newWebsites);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newWebsites = [...reorderedWebsites];
    [newWebsites[index], newWebsites[index - 1]] = [newWebsites[index - 1], newWebsites[index]];
    setReorderedWebsites(newWebsites);
  };

  const moveDown = (index: number) => {
    if (index === reorderedWebsites.length - 1) return;
    const newWebsites = [...reorderedWebsites];
    [newWebsites[index], newWebsites[index + 1]] = [newWebsites[index + 1], newWebsites[index]];
    setReorderedWebsites(newWebsites);
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const websiteIds = reorderedWebsites.map(website => website._id!);
      await onReorder(websiteIds);
      onClose();
    } catch (error) {
      console.error('Error saving order:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = () => {
    const currentOrder = websites
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
      .map(w => w._id);
    const newOrder = reorderedWebsites.map(w => w._id);
    return JSON.stringify(currentOrder) !== JSON.stringify(newOrder);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-[95vw] h-[95vh] max-h-[95vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <GripVertical className="w-5 h-5" />
            Reorder Websites
          </DialogTitle>
          <DialogDescription>
            Drag and drop to reorder websites. Lower positions appear first on the site.
            <br />
            <span className="text-xs text-muted-foreground">
              💡 Tip: Use drag handles or ↑↓ arrows to change order
            </span>
          </DialogDescription>

          {/* Search Bar */}
          {reorderedWebsites.length > 5 && (
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search websites..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          )}

          {/* Header Stats */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2">
            <span>Total: {reorderedWebsites.length} websites</span>
            {searchTerm && <span>Showing: {filteredWebsites.length} websites</span>}
            <span>Featured: {reorderedWebsites.filter(w => w.featured).length}</span>
            {hasChanges() && (
              <span className="text-orange-600 dark:text-orange-400 font-medium">
                ⚠ Unsaved changes
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Website List */}
        <div className="flex-1 overflow-hidden min-h-0">
          <div className="h-full overflow-y-auto scrollbar-thin pr-2" style={{ minHeight: '400px' }}>
            <div className="space-y-2 pb-4">
              {reorderedWebsites.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <GripVertical className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No websites to reorder</p>
                  <p className="text-sm">Add some websites first to manage their display order</p>
                </div>
              ) : searchTerm && filteredWebsites.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No websites found</p>
                  <p className="text-sm">Try adjusting your search terms</p>
                  <Button
                    variant="ghost"
                    onClick={() => setSearchTerm('')}
                    className="mt-2"
                  >
                    Clear search
                  </Button>
                </div>
              ) : (
                (searchTerm ? filteredWebsites : reorderedWebsites).map((website, index) => {
                  // Get the actual index in the full list for proper reordering
                  const actualIndex = reorderedWebsites.findIndex(w => w._id === website._id);
                  return (
                <div
                  key={website._id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, actualIndex)}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDrop={(e) => handleDrop(e, actualIndex)}
                  onDragEnd={handleDragEnd}
                  className={`
                    flex items-center gap-3 p-4 bg-background border rounded-lg cursor-move transition-all
                    ${draggedIndex === actualIndex ? 'opacity-50 scale-95 shadow-lg border-primary' : 'hover:bg-muted/50 hover:border-muted-foreground/50'}
                    ${draggedIndex !== null && draggedIndex !== actualIndex ? 'transform scale-[0.98]' : ''}
                    ${searchTerm ? 'ring-1 ring-primary/20' : ''}
                  `}
                >
                  {/* Drag Handle & Position */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <GripVertical className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                    <Badge
                      variant="outline"
                      className="w-10 h-7 flex items-center justify-center text-sm font-mono bg-primary/5 border-primary/20"
                    >
                      {actualIndex + 1}
                    </Badge>
                  </div>

                  {/* Website Image */}
                  <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-lg overflow-hidden border flex-shrink-0">
                    <Image
                      src={website.image}
                      alt={website.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>

                  {/* Website Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base truncate">{website.name}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {website.category}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-md">
                      {website.description}
                    </div>
                  </div>

                  {/* Badges & Controls */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Featured Badge */}
                    {website.featured && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800 text-xs hidden sm:inline-flex">
                        Featured
                      </Badge>
                    )}

                    {/* Manual Up/Down Controls */}
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-primary/10"
                        onClick={() => moveUp(actualIndex)}
                        disabled={actualIndex === 0}
                        title="Move up"
                      >
                        ▲
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-primary/10"
                        onClick={() => moveDown(actualIndex)}
                        disabled={actualIndex === reorderedWebsites.length - 1}
                        title="Move down"
                      >
                        ▼
                      </Button>
                    </div>
                  </div>
                </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="flex-shrink-0 border-t pt-4 mt-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            {/* Status Info */}
            <div className="text-sm text-muted-foreground">
              {searchTerm ? (
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  <span>Search active - showing {filteredWebsites.length} of {reorderedWebsites.length}</span>
                </div>
              ) : hasChanges() ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>You have unsaved changes</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>All changes saved</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 sm:flex-none"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isLoading || !hasChanges()}
                className="flex-1 sm:flex-none bg-primary hover:bg-primary/90"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving Order...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save New Order
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}