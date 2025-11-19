"use client"

import { useState, useEffect } from "react";
import Link from "next/link";

interface RegistryItem {
  name: string;
  type: string;
  title?: string;
  description?: string;
}

interface ComponentCategory {
  name: string;
  components: number;
  description: string;
  items: RegistryItem[];
}

export default function ComponentsPage() {
  const [categories, setCategories] = useState<ComponentCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComponents = async () => {
      try {
        const response = await fetch("/registry");
        if (response.ok) {
          const data = await response.json();
          
          // Fetch details for each component
          const detailedComponents = await Promise.all(
            data.items.map(async (item: RegistryItem) => {
              try {
                const detailResponse = await fetch(`/r/${item.name}.json`);
                if (detailResponse.ok) {
                  const detail = await detailResponse.json();
                  return {
                    ...item,
                    title: detail.title,
                    description: detail.description
                  };
                }
              } catch (error) {
                console.error(`Error fetching ${item.name}:`, error);
              }
              return item;
            })
          );
          
          // Group by type for now (you can customize this)
          const grouped: ComponentCategory[] = [{
            name: "UI Components",
            components: detailedComponents.length,
            description: "Beautiful, accessible components for your Next.js applications.",
            items: detailedComponents
          }];
          
          setCategories(grouped);
        }
      } catch (error) {
        console.error("Error fetching components:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchComponents();
  }, []);

  if (loading) {
    return (
      <div className="w-full">
        <section className="pb-2">
          <div className="relative mx-auto max-w-2xl overflow-hidden px-4 py-6 sm:px-6 sm:py-8 text-center">
            <div className="relative space-y-4">
              <div className="h-12 bg-muted rounded w-3/4 mx-auto animate-pulse"></div>
              <div className="h-6 bg-muted rounded w-2/3 mx-auto animate-pulse"></div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="w-full">
      <section className="pb-2">
        <div className="relative mx-auto max-w-2xl overflow-hidden px-4 py-6 sm:px-6 sm:py-8 text-center">
          <div className="relative space-y-4">
            <h1 className="text-foreground text-[24px] xs:text-[28px] sm:text-[36px] md:text-[42px] lg:text-[48px] font-normal leading-[1.1] sm:leading-[1.15] md:leading-[1.2] font-serif tracking-tight">
              Browse Components
            </h1>
            <p className="mx-auto max-w-xl text-sm sm:text-base text-muted-foreground">
              Explore our collection of beautifully designed, accessible components.
              Copy the code and customize them to fit your needs.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-2 sm:gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category, index) => (
          <Link
            key={category.name}
            href={`/components/${category.name.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <button className="group relative flex flex-col justify-between rounded-[10px] border border-dashed border-border/20 bg-card/60 px-4 py-4 sm:px-5 sm:py-5 text-left transition hover:border-primary/50 hover:bg-accent/10 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 w-full">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-medium text-muted-foreground/80">
                  #{String(index + 1).padStart(2, "0")}
                </span>
                <span className="inline-flex items-center rounded-full border border-dashed border-border/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground/80">
                  {category.components} components
                </span>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium sm:text-base tracking-tight text-foreground">
                  {category.name}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {category.description}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground/80">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  Click to explore
                </span>
                <span className="inline-flex items-center gap-1">
                  View components
                  <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                    ↗
                  </span>
                </span>
              </div>
            </button>
          </Link>
        ))}
      </section>
    </div>
  );
}
