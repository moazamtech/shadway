import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Edit,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { Website } from '@/lib/types';
import Image from 'next/image';

interface WebsitesTableProps {
  websites: Website[];
  currentPage: number;
  totalPages: number;
  onEdit: (website: Website) => void;
  onDelete: (id: string) => void;
  onPageChange: (page: number) => void;
  onReorder?: (websiteId: string, direction: 'up' | 'down') => void;
}

export function WebsitesTable({
  websites,
  currentPage,
  totalPages,
  onEdit,
  onDelete,
  onPageChange,
  onReorder
}: WebsitesTableProps) {
  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold w-16">Order</TableHead>
              <TableHead className="font-semibold">Website</TableHead>
              <TableHead className="font-semibold">Category</TableHead>
              <TableHead className="font-semibold">Tags</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {websites.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No websites found matching your criteria
                </TableCell>
              </TableRow>
            ) : (
              websites.map((website) => (
                <TableRow key={website._id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="py-4">
                    <div className="flex flex-col items-center space-y-1">
                      <Badge variant="outline" className="w-8 h-6 rounded flex items-center justify-center text-xs font-mono">
                        {website.sequence || 0}
                      </Badge>
                      {onReorder && (
                        <div className="flex flex-col">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-6 p-0 hover:bg-muted"
                            onClick={() => onReorder(website._id!, 'up')}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-6 p-0 hover:bg-muted"
                            onClick={() => onReorder(website._id!, 'down')}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center space-x-3">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden border">
                        <Image
                          src={website.image}
                          alt={website.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{website.name}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-xs">
                          {website.description}
                        </div>
                        <div className="text-xs text-primary hover:text-primary/80 cursor-pointer truncate">
                          {website.url}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge variant="secondary">
                      {website.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex flex-wrap gap-1">
                      {website.tags?.slice(0, 2).map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {website.tags && website.tags.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{website.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2">
                      {website.featured && (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800">
                          Featured
                        </Badge>
                      )}
                      <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800">
                        Active
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(website.url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(website)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(website._id!)}
                        className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t">
          <div className="flex items-center text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                let pageNumber;
                if (totalPages <= 5) {
                  pageNumber = index + 1;
                } else if (currentPage <= 3) {
                  pageNumber = index + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNumber = totalPages - 4 + index;
                } else {
                  pageNumber = currentPage - 2 + index;
                }

                return (
                  <Button
                    key={pageNumber}
                    variant={currentPage === pageNumber ? "default" : "outline"}
                    size="sm"
                    onClick={() => onPageChange(pageNumber)}
                  >
                    {pageNumber}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}