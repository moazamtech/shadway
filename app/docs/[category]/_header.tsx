"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Component } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CategoryPageHeaderProps {
  category: string;
  categoryName: string;
  componentCount: number;
}

export function CategoryPageHeader({
  category,
  categoryName,
  componentCount,
}: CategoryPageHeaderProps) {
  const router = useRouter();

  return (
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
            <span className="text-foreground">{componentCount} ITEMS</span>
          </div>
          <div className="w-px h-8 bg-border/40" />
          <div className="flex flex-col gap-1">
            <span className="uppercase tracking-widest text-foreground/40 text-[9px]">
              Module Type
            </span>
            <span className="text-primary flex items-center gap-1.5 capitalize">
              <Component className="w-3 h-3" />
              {category === "all" ? "All Categories" : category}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
