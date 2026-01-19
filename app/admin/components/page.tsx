"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Plus, 
  Search, 
  ExternalLink, 
  FileJson, 
  FileCode,
  Tag,
  Layout
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

interface ComponentItem {
  name: string;
  type: string;
  category?: string;
  title?: string;
}

export default function AdminComponentsPage() {
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComponents = async () => {
      try {
        const response = await fetch("/registry");
        if (response.ok) {
          const data = await response.json();
          setComponents(data.items || []);
        }
      } catch (error) {
        console.error("Error fetching components:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchComponents();
  }, []);

  const filteredComponents = components.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Components</h1>
          <p className="text-muted-foreground">
            Manage your component registry and categories.
          </p>
        </div>
        <Link href="/admin/components/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            New Component
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search components or categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Component</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10">
                  Loading components...
                </TableCell>
              </TableRow>
            ) : filteredComponents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                  No components found.
                </TableCell>
              </TableRow>
            ) : (
              filteredComponents.map((component) => (
                <TableRow key={component.name}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{component.name}</span>
                      <span className="text-xs text-muted-foreground">{component.title || component.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="gap-1">
                      <Tag className="w-3 h-3" />
                      {component.category || "general"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {component.type}
                    </code>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" asChild title="View JSON">
                        <Link href={`/r/${component.name}.json`} target="_blank">
                          <FileJson className="w-4 h-4 text-orange-500" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild title="View Source">
                        <Link href={`/registry/${component.name}/${component.name}.tsx`} target="_blank">
                          <FileCode className="w-4 h-4 text-blue-500" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild title="View in Docs">
                        <Link href={`/components/${component.category || "general"}#${component.name}`} target="_blank">
                          <ExternalLink className="w-4 h-4" />
                        </Link>
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
  );
}
