"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RegistryBlock } from "@/components/registry-block";
import { Skeleton } from "@/components/ui/skeleton";
import { RegistryBlockSkeleton } from "@/components/registry-block-skeleton";
import { ComponentRegistry } from "@/lib/types";

export default function CategoryPage() {
  const { category } = useParams();
  const router = useRouter();
  const [components, setComponents] = useState<ComponentRegistry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategoryComponents = async () => {
      try {
        const response = await fetch("/registry");
        if (!response.ok) throw new Error("Failed to fetch registry");

        const data = await response.json();

        // Filter by category
        const categoryItems = data.items.filter(
          (item: any) => (item.category || "ui").toLowerCase() === (category as string).toLowerCase()
        );

        const detailedComponents = await Promise.all(
          categoryItems.map(async (item: any) => {
            const detailResponse = await fetch(`/r/${item.name}.json`);
            if (detailResponse.ok) return detailResponse.json();
            return null;
          })
        );

        setComponents(detailedComponents.filter(Boolean));
      } catch (err) {
        console.error("Error fetching components:", err);
        setError("Could not load components for this category.");
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryComponents();
  }, [category]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="relative w-screen left-[50%] right-[50%] -ml-[50vw] -mr-[50vw]">
          <div className="absolute bottom-0 w-full flex flex-col">
            <div className="w-full border-b border-dashed border-border" />
            <div className="w-full h-4 bg-[image:repeating-linear-gradient(45deg,transparent,transparent_4px,var(--color-border)_4px,var(--color-border)_5px)] opacity-20" />
            <div className="w-full border-b border-dashed border-border" />
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-10">
            <div className="mb-8 w-32 h-9 bg-muted animate-pulse rounded-md" />
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-64 md:h-14 md:w-80 rounded-lg" />
                <Skeleton className="h-7 w-28 rounded-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-full max-w-2xl rounded" />
                <Skeleton className="h-5 w-3/4 max-w-xl rounded" />
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 space-y-24">
          {[1, 2, 3].map((i) => (
            <RegistryBlockSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const categoryName = (category as string).charAt(0).toUpperCase() + (category as string).slice(1);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Dynamic Header */}
      <div className="relative w-screen left-[50%] right-[50%] -ml-[50vw] -mr-[50vw]">
        <div className="absolute bottom-0 w-full flex flex-col">
          <div className="w-full border-b border-dashed border-border" />
          <div className="w-full h-4 bg-[image:repeating-linear-gradient(45deg,transparent,transparent_4px,var(--color-border)_4px,var(--color-border)_5px)] opacity-20" />
          <div className="w-full border-b border-dashed border-border" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-10">
          <Button
            variant="ghost"
            size="sm"
            className="mb-8 gap-2 -ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => router.push("/docs")}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </Button>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter uppercase">
                {categoryName}<span className="text-primary">.</span>
              </h1>
              <div className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase tracking-widest border border-primary/20">
                {components.length} {components.length === 1 ? 'Component' : 'Components'}
              </div>
            </div>
            <p className="text-lg md:text-xl text-muted-foreground font-light max-w-2xl">
              A collection of professionally designed {categoryName.toLowerCase()} blocks,
              optimized for your next production application.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-8 px-4 sm:px-8">
        {error && (
          <Alert variant="destructive" className="mb-12">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {components.length === 0 && !error && (
          <div className="text-center py-20 border-2 border-dashed rounded-3xl">
            <p className="text-muted-foreground">No components found in the "{categoryName}" category yet.</p>
          </div>
        )}

        <div className="space-y-24 divide-y divide-border/40">
          {components.map((component, index) => (
            <RegistryBlock
              key={component.name}
              index={index}
              name={component.name}
              title={component.title || component.name}
              description={component.description}
              category={category as string}
              code={component.files[0]?.content || ""}
              installCommand={`npx shadcn@latest add https://shadway.online/r/${component.name}.json`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
