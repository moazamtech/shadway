"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { LandingHeader } from "@/components/landing/header";
import { ArrowUpRight, Layout, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PREVIEWS,
  AIPreview,
} from "@/components/docs/previews/category-previews";
import { CATEGORIES_CONFIG } from "@/lib/docs-config";

export default function BlocksPage() {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

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

  const dynamicNames = new Set(
    dynamicCategories.map((c) => c.name.toLowerCase()),
  );
  const staticCategories = CATEGORIES_CONFIG.filter(
    (cat) => !dynamicNames.has(cat.name.toLowerCase()),
  ).map((cat) => ({ ...cat, isDynamic: false }));

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground relative">
        <div className="relative mx-auto w-full max-w-7xl">
          {/* Continuous vertical rails */}
          <div className="absolute inset-y-0 left-0 z-100 w-[2px] bg-border/70" />
          <div className="absolute inset-y-0 left-2 z-100 w-[2px] bg-border/40" />
          <div className="absolute inset-y-0 right-0 z-100 w-[2px] bg-border/70" />
          <div className="absolute inset-y-0 right-2 z-100 w-[2px] bg-border/40" />

          <LandingHeader />

          <div className="max-w-7xl mx-auto px-[10px] py-6 md:py-12 relative">
            <section className="mb-12 space-y-8 relative px-6 md:px-12">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-px w-8 bg-primary/40" />
                  <Skeleton className="h-3 w-32 rounded-none opacity-40" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-12 w-64 md:h-20 md:w-[600px] rounded-none" />
                  <Skeleton className="h-12 w-48 md:h-20 md:w-96 rounded-none opacity-40 ml-0 md:ml-12" />
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-8 border-t border-border/40">
                <div className="space-y-3 max-w-xl">
                  <Skeleton className="h-4 w-full rounded-none" />
                  <Skeleton className="h-4 w-5/6 rounded-none" />
                </div>
                <div className="flex items-center gap-6">
                  <Skeleton className="h-10 w-24 rounded-none" />
                  <Skeleton className="h-10 w-24 rounded-none" />
                </div>
              </div>
            </section>

            <section className="space-y-0">
              <div className="flex items-center justify-between py-6 border-b border-border/40 px-6 md:px-12">
                <Skeleton className="h-4 w-32 rounded-none" />
                <Skeleton className="h-4 w-20 rounded-none" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-l border-border/40">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-[10px] py-6 md:py-12 relative">
        {/* Header Section */}
        <section className="mb-12 space-y-8 relative px-6 md:px-12">
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.3em] uppercase text-primary/80 mb-2"
            >
              <div className="w-8 h-px bg-primary/40" />
              Components Library
            </motion.div>

            <h1 className="text-5xl md:text-8xl font-medium tracking-tight leading-[0.9]">
              Premium UI
              <br />
              <span className="text-muted-foreground/40 font-serif italic">
                Blocks
              </span>{" "}
              Archive.
            </h1>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-8 border-t border-border/40">
            <p className="max-w-xl text-lg text-muted-foreground/80 font-light leading-relaxed">
              Curated collection of high-end Shadcn UI components, templates,
              and inspiration. Built for speed, aesthetics, and modern
              workflows.
            </p>

            <div className="flex items-center gap-6 text-[11px] font-mono text-muted-foreground/60">
              <div className="flex flex-col gap-1">
                <span className="uppercase tracking-widest text-foreground/40 text-[9px]">
                  Total Items
                </span>
                <span className="text-foreground">
                  {dynamicCategories.length + staticCategories.length} BRICKs
                </span>
              </div>
              <div className="w-px h-8 bg-border/40" />
              <div className="flex flex-col gap-1">
                <span className="uppercase tracking-widest text-foreground/40 text-[9px]">
                  Status
                </span>
                <span className="text-primary flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  Live Registry
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Blocks Section */}
        <section className="space-y-0">
          <div className="flex items-center justify-between py-6 border-b border-border/40 px-6 md:px-12">
            <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-foreground/60">
              Active Blocks
            </h2>
            <Link
              href="/docs/all"
              className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors flex items-center gap-2 group"
            >
              View All{" "}
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-l border-border/40"
          >
            {dynamicCategories.map((category, index) => (
              <Card key={category.name} category={category} index={index} />
            ))}
          </motion.div>
        </section>

        {/* Static / Future Blocks Section */}
        {staticCategories.length > 0 && (
          <section className="mt-16 space-y-0 group">
            <div className="flex items-center gap-4 py-6 border-b border-border/40 px-6 md:px-12">
              <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground/60 italic">
                Experimental / In Lab
              </h2>
              <div className="h-px w-8 bg-border/40" />
            </div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-l border-border/40 opacity-70 group-hover:opacity-100 transition-opacity"
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

      {/* Bottom decorative line */}
      <div className="h-px w-full bg-border/20 mt-20" />
    </div>
  );
}

function Card({ category, index }: { category: any; index: number }) {
  const itemVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1 },
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

  const CardContent = (
    <motion.div
      variants={itemVariants}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group relative flex h-[400px] flex-col overflow-hidden border-r border-b border-border/40 bg-background transition-colors duration-500 hover:bg-muted/5 cursor-pointer"
    >
      {/* Background Index - Subtle */}
      <div className="absolute top-6 left-6 z-0 text-[60px] font-bold font-mono text-muted-foreground/5 leading-none select-none group-hover:text-primary/5 transition-colors">
        {String(index + 1).padStart(2, "0")}
      </div>

      <div className="h-56 w-full relative z-10 flex items-center justify-center p-6 grayscale group-hover:grayscale-0 transition-all duration-700">
        <div className="w-full h-full border border-border/20 rounded-none overflow-hidden relative">
          <Preview isHovered={isHovered} />

          {/* Animated corner reveal on hover */}
          <div className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none">
            <motion.div
              initial={{ width: 0, height: 0 }}
              animate={
                isHovered
                  ? { width: "100%", height: "100%" }
                  : { width: 0, height: 0 }
              }
              className="absolute bottom-0 right-0 border-r border-b border-primary/40 -m-px"
            />
          </div>
        </div>
      </div>

      <div className="p-8 pb-10 flex flex-col grow relative z-10">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3 text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">
            <span>Module 0{index + 1}</span>
            <Badge
              variant="outline"
              className="text-[9px] font-mono px-1.5 py-0 border-border/40 bg-transparent text-muted-foreground/60"
            >
              {category.blocks || 0} ITEMS
            </Badge>
          </div>

          <h3 className="text-2xl font-medium tracking-tight text-foreground flex items-center group/title transition-all duration-300">
            {category.name}
            <ArrowUpRight className="w-4 h-4 ml-2 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all duration-300" />
          </h3>

          <p className="text-sm text-muted-foreground/60 line-clamp-2 mt-3 leading-relaxed font-light">
            {category.description}
          </p>
        </div>

        <div className="mt-auto flex items-center gap-4 pt-4">
          <div className="h-px flex-1 bg-border/20 group-hover:bg-primary/20 transition-colors" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 group-hover:text-primary transition-colors duration-500">
            {category.isDynamic ? "Enter Module" : "Locked"}
          </span>
        </div>
      </div>

      {/* Bottom accent line that expands on hover */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={isHovered ? { scaleX: 1 } : { scaleX: 0 }}
        transition={{ duration: 0.4 }}
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary origin-left"
      />
    </motion.div>
  );

  if (category.isDynamic) {
    return (
      <Link
        href={`/docs/${category.originalCategory || "hero"}`}
        className="h-full"
      >
        {CardContent}
      </Link>
    );
  }

  return (
    <div className="h-full cursor-not-allowed opacity-60">{CardContent}</div>
  );
}

function CardSkeleton() {
  return (
    <div className="flex flex-col h-[400px] overflow-hidden border-r border-b border-border/40 bg-background">
      <div className="h-56 w-full p-6">
        <Skeleton className="w-full h-full rounded-none" />
      </div>
      <div className="p-8 space-y-4">
        <Skeleton className="h-4 w-24 rounded-none" />
        <Skeleton className="h-8 w-3/4 rounded-none" />
        <Skeleton className="h-16 w-full rounded-none" />
      </div>
    </div>
  );
}
