"use client";

import React from "react";
import { motion, type Variants } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight, Layout } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PREVIEWS,
  AIPreview,
} from "@/components/docs/previews/category-previews";
import { CATEGORIES_CONFIG } from "@/lib/docs-config";
import { useTheme } from "next-themes";
import { TechnicalGrid } from "@/components/site-components/ornaments";

export default function BlocksPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const heroShaderColors = isDark
    ? ["#2596be", "#0154a5", "#0241a7"]
    : ["#0154a5", "#0154a5", "#0241a7"];
  const heroShaderBack = isDark ? "#0a0a0a" : "#ffffff";
  const [mounted, setMounted] = React.useState(false);

  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setMounted(true);
    fetch("/registry")
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items || []);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
      });
  }, []);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  // 1. Group items present in the registry
  const registryCategoriesMap = items.reduce((acc: any, item: any) => {
    const cat = item.category || "other";
    if (!acc[cat]) {
      acc[cat] = {
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        count: 0,
        originalCategory: cat.toLowerCase(),
      };
    }
    acc[cat].count++;
    return acc;
  }, {});

  const dynamicCategories = Object.values(registryCategoriesMap).map(
    (cat: any) => {
      const config = CATEGORIES_CONFIG.find(
        (c) => c.name.toLowerCase() === cat.name.toLowerCase(),
      ) || {
        description: `Collection of ${cat.name} blocks and components.`,
        icon: Layout,
      };

      return {
        ...config,
        name: cat.name,
        blocks: cat.count,
        originalCategory: cat.originalCategory,
        isDynamic: true,
      };
    },
  );

  // 2. Identify remaining hardcoded categories for "Future Blocks"
  const dynamicNames = new Set(
    dynamicCategories.map((c) => c.name.toLowerCase()),
  );
  const staticCategories = CATEGORIES_CONFIG.filter(
    (cat) => !dynamicNames.has(cat.name.toLowerCase()),
  ).map((cat) => ({ ...cat, isDynamic: false }));

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-background text-foreground px-4 py-12 md:px-8 md:py-16 overflow-hidden">
        <TechnicalGrid />
        <section className="mb-20 text-center space-y-6">
          <Skeleton className="h-10 md:h-16 w-64 md:w-96 mx-auto rounded-xl" />
          <div className="space-y-3 mt-4">
            <Skeleton className="h-5 w-full max-w-xl mx-auto rounded-lg" />
            <Skeleton className="h-5 w-3/4 max-w-lg mx-auto rounded-lg" />
          </div>
        </section>

        <section className="max-w-7xl mx-auto space-y-12 px-6 lg:px-12">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-32 rounded" />
            <div className="h-px flex-1 bg-border/60" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-background text-foreground overflow-hidden">
      {/* Blueprint Header */}
      <section className="relative px-6 pt-16 pb-24 lg:px-12 overflow-visible border-b border-border/40">
        <TechnicalGrid />

        <div className="relative pt-12">
          <div className="flex flex-col items-center text-center space-y-8">
            <div className="relative">
              <motion.div
                className="absolute -top-12 -left-12 size-24 border-l border-t border-primary/20 pointer-events-none"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
              />
              <motion.div
                className="absolute -bottom-12 -right-12 size-24 border-r border-b border-primary/20 pointer-events-none"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
              />

              <motion.h1
                className="text-6xl md:text-9xl font-serif font-medium tracking-tighter relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
              >
                UI LIBRARY
                <span className="text-primary tracking-tighter block md:inline md:ml-2">
                  .
                </span>
              </motion.h1>
            </div>

            <motion.p
              className="mx-auto max-w-2xl text-lg md:text-2xl text-foreground/70 font-light tracking-tight leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.1,
                ease: [0.25, 0.4, 0.25, 1],
              }}
            >
              Premium blocks and components designed for
              <br className="hidden sm:block" />
              modern web applications.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Dynamic Blocks Section */}
      <section className="px-6 py-24 lg:px-12 max-w-7xl mx-auto space-y-16">
        <div className="flex items-center gap-6">
          <h2 className="text-xs font-bold tracking-[0.4em] uppercase text-primary">
            Active Registry
          </h2>
          <div className="h-px flex-1 bg-linear-to-r from-border/80 to-transparent" />
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6"
        >
          {dynamicCategories.map((category, index) => (
            <Card key={category.name} category={category} index={index} />
          ))}
        </motion.div>
      </section>

      {/* Static / Future Blocks Section */}
      {staticCategories.length > 0 && (
        <section className="px-6 py-24 lg:px-12 max-w-7xl mx-auto space-y-16 bg-muted/5 border-t border-border-20">
          <div className="flex items-center gap-6">
            <h2 className="text-xs font-bold tracking-[0.4em] uppercase text-muted-foreground/60">
              Coming Soon
            </h2>
            <div className="h-px flex-1 bg-linear-to-r from-border-40 to-transparent" />
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6"
          >
            {staticCategories.map((category, index) => (
              <Card
                key={category.name}
                category={category}
                index={index + dynamicCategories.length}
              />
            ))}
          </motion.div>
        </section>
      )}
    </div>
  );
}

function Card({ category, index }: { category: any; index: number }) {
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.25, 0.4, 0.25, 1] as const },
    },
  };

  const [isHovered, setIsHovered] = React.useState(false);

  const Preview =
    PREVIEWS[category.name] ||
    PREVIEWS[
      category.name.charAt(0).toUpperCase() +
        category.name.slice(1).toLowerCase()
    ] ||
    PREVIEWS[category.name.toUpperCase()] ||
    AIPreview;

  return (
    <motion.div
      variants={itemVariants}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group relative flex flex-col h-full grow"
    >
      {/* Blueprint Borders */}
      <div className="absolute top-0 left-0 size-8 border-l-2 border-t-2 border-primary/0 group-hover:border-primary/20 group-hover:-translate-x-1 group-hover:-translate-y-1 transition-all duration-300 pointer-events-none" />
      <div className="absolute bottom-0 right-0 size-8 border-r-2 border-b-2 border-primary/0 group-hover:border-primary/20 group-hover:translate-x-1 group-hover:translate-y-1 transition-all duration-300 pointer-events-none" />

      <div className="relative flex h-full flex-col overflow-hidden bg-card transition-all duration-500 border border-border group-hover:border-primary/40 group-hover:shadow-[20px_20px_60px_-15px_rgba(0,0,0,0.05)] dark:group-hover:shadow-[20px_20px_60px_-15px_rgba(0,0,0,0.3)]">
        {/* Preview Area */}
        <div className="h-60 w-full relative bg-muted/5 group-hover:bg-muted/10 transition-colors overflow-hidden">
          {/* Dot Grid */}
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "radial-gradient(circle, currentColor 1px, transparent 1px)",
              backgroundSize: "12px 12px",
            }}
          />

          <Preview isHovered={isHovered} />
        </div>

        {/* Content Area */}
        <div className="p-6 flex flex-col grow border-t border-border-40">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <h3 className="font-serif text-2xl font-medium tracking-tight text-foreground transition-all duration-300 group-hover:translate-x-1">
                {category.name}
              </h3>
            </div>

            {category.isDynamic ? (
              <Link
                href={`/docs/${category.originalCategory || "hero"}`}
                className="flex items-center gap-1.5 text-[10px] font-bold text-primary tracking-widest uppercase group/link"
              >
                <span className="border-b-2 border-primary/20 group-hover/link:border-primary/60 transition-all">
                  Explore
                </span>
                <ArrowUpRight className="size-3.5 transition-all group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
              </Link>
            ) : (
              <div className="font-mono text-[9px] text-muted-foreground/40 flex items-center gap-1 uppercase tracking-widest">
                Upcoming
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CardSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden border border-border bg-card">
      <div className="h-60 w-full relative bg-muted/5 p-12 flex items-center justify-center">
        <div className="w-full h-full border-2 border-dashed border-primary/5 rounded-lg opacity-20" />
      </div>
      <div className="p-6 flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}
