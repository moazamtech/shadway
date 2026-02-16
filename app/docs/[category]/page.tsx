"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, AlertCircle, Component } from "lucide-react";
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
          (item: any) =>
            (item.category || "ui").toLowerCase() ===
            (category as string).toLowerCase(),
        );

        const detailedComponents = await Promise.all(
          categoryItems.map(async (item: any) => {
            const detailResponse = await fetch(`/r/${item.name}.json`);
            if (detailResponse.ok) return detailResponse.json();
            return null;
          }),
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

  const categoryName =
    (category as string).charAt(0).toUpperCase() +
    (category as string).slice(1);

  if (loading) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 md:py-24 space-y-24">
          <div className="space-y-6">
            <Skeleton className="h-4 w-32 rounded-none" />
            <Skeleton className="h-16 w-1/2 rounded-none" />
            <Skeleton className="h-20 w-3/4 rounded-none" />
          </div>

          {[1, 2].map((i) => (
            <RegistryBlockSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-2 py-4 md:py-6 relative">
        {/* Header Section */}
        <section className="mb-12 space-y-4 relative px-6 md:px-12">
          <Button
            variant="ghost"
            size="sm"
            className="group -ml-3 gap-2 text-muted-foreground/60 hover:text-foreground transition-colors uppercase text-[10px] font-bold tracking-widest px-3"
            onClick={() => router.push("/docs")}
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            Back to Blocks
          </Button>

          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.3em] uppercase text-primary/80 mb-2"
            >
              <div className="w-8 h-px bg-primary/40" />
              Module Category
            </motion.div>

            <h1 className="text-5xl md:text-8xl font-medium tracking-tight leading-[0.9]">
              {categoryName}
              <br />
              <span className="text-muted-foreground/40 font-serif italic">
                Archive
              </span>
              .
            </h1>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-8 border-t border-border/40">
            <p className="max-w-xl text-lg text-muted-foreground/80 font-light leading-relaxed">
              Professionally built {categoryName.toLowerCase()} components and
              blocks. Designed for high-performance and visual excellence in
              production.
            </p>

            <div className="flex items-center gap-6 text-[11px] font-mono text-muted-foreground/60">
              <div className="flex flex-col gap-1">
                <span className="uppercase tracking-widest text-foreground/40 text-[9px]">
                  Inventory
                </span>
                <span className="text-foreground">
                  {components.length} ITEMS
                </span>
              </div>
              <div className="w-px h-8 bg-border/40" />
              <div className="flex flex-col gap-1">
                <span className="uppercase tracking-widest text-foreground/40 text-[9px]">
                  Module Type
                </span>
                <span className="text-primary flex items-center gap-1.5 capitalize">
                  <Component className="w-3 h-3" />
                  {category as string}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <div className="space-y-0">
          {error && (
            <Alert
              variant="destructive"
              className="mb-12 rounded-none border-destructive/20 bg-destructive/5"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs font-bold uppercase tracking-widest">
                System Error
              </AlertTitle>
              <AlertDescription className="text-sm opacity-80">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {components.length === 0 && !error && (
            <div className="text-center py-20 border border-dashed border-border/40 mx-6 md:mx-12">
              <p className="text-sm text-muted-foreground/60 font-mono uppercase tracking-[0.2em]">
                Empty Module / No items discovered
              </p>
            </div>
          )}

          <div className="space-y-16 divide-y divide-border/20">
            {components.map((component, index) => (
              <div key={component.name} className={index === 0 ? "" : "pt-16"}>
                <RegistryBlock
                  index={index}
                  name={component.name}
                  title={component.title || component.name}
                  description={component.description}
                  category={category as string}
                  code={component.files[0]?.content || ""}
                  installCommand={`npx shadcn@latest add https://shadway.online/r/${component.name}.json`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Line */}
      <div className="h-px w-full bg-border/10 mt-20" />
    </div>
  );
}
