"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight, Layout } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  PREVIEWS,
  AIPreview,
} from "@/components/docs/previews/category-previews";

interface Category {
  name: string;
  description: string;
  blocks: number;
  originalCategory: string;
  isDynamic: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
};

function Card({ category, index }: { category: Category; index: number }) {
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
      <div className="absolute top-6 left-6 z-0 text-[60px] font-bold font-mono text-muted-foreground/5 leading-none select-none group-hover:text-primary/5 transition-colors">
        {String(index + 1).padStart(2, "0")}
      </div>

      <div className="h-56 flex-shrink-0 w-full relative z-10 flex items-center justify-center p-6 grayscale group-hover:grayscale-0 transition-all duration-700">
        <div className="w-full h-full border border-border/20 rounded-none overflow-hidden relative">
          <Preview isHovered={isHovered} />
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

      <div className="p-8 pb-10 flex flex-col grow min-h-0 relative z-10">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3 text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">
            <span>Module {String(index + 1).padStart(2, "0")}</span>
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
      <Link href={`/docs/${category.originalCategory}`} className="h-full">
        {CardContent}
      </Link>
    );
  }

  return (
    <div className="h-full cursor-not-allowed opacity-60">{CardContent}</div>
  );
}

export function BlocksGrid({
  dynamicCategories,
  staticCategories,
}: {
  dynamicCategories: Category[];
  staticCategories: Category[];
}) {
  return (
    <>
      {/* Dynamic Blocks Section */}
      <section className="space-y-0">
        <div className="flex items-center justify-between py-6 px-6 md:px-12">
          <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-foreground/60">
            Active Blocks
          </h2>
          <Link
            href="/docs/all"
            className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors flex items-center gap-2 group"
          >
            View All{" "}
            <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-l border-t border-border/40"
        >
          {dynamicCategories.map((category, index) => (
            <Card key={category.name} category={category} index={index} />
          ))}
        </motion.div>
      </section>

      {/* Static / Future Blocks Section */}
      {staticCategories.length > 0 && (
        <section className="mt-16 space-y-0 group">
          <div className="flex items-center gap-4 py-6 px-6 md:px-12">
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
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-l border-t border-border/40 opacity-70 group-hover:opacity-100 transition-opacity"
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
    </>
  );
}
