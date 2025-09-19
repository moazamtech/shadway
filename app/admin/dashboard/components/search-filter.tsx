import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';

interface SearchFilterProps {
  searchTerm: string;
  categoryFilter: string;
  categories: string[];
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onClear: () => void;
}

export function SearchFilter({
  searchTerm,
  categoryFilter,
  categories,
  onSearchChange,
  onCategoryChange,
  onClear
}: SearchFilterProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search websites, categories, or tags..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="flex gap-2">
        <Select
          value={categoryFilter}
          onValueChange={onCategoryChange}
        >
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(searchTerm || categoryFilter) && (
          <Button variant="outline" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}