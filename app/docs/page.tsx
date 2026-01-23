"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { 
  ArrowUpRight, 
  Layout, 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PREVIEWS, AIPreview } from "@/components/docs/previews/category-previews";
import { CATEGORIES_CONFIG } from "@/lib/docs-config";

export default function BlocksPage() {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/registry")
      .then(res => res.json())
      .then(data => {
        setItems(data.items || []);
        setLoading(false);
      })
      .catch(err => {
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

  // 1. Group items present in the registry
  const registryCategoriesMap = items.reduce((acc: any, item: any) => {
    const cat = item.category || "other";
    if (!acc[cat]) {
      acc[cat] = {
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        count: 0,
        originalCategory: cat.toLowerCase()
      };
    }
    acc[cat].count++;
    return acc;
  }, {});

  const dynamicCategories = Object.values(registryCategoriesMap).map((cat: any) => {
    const config = CATEGORIES_CONFIG.find(c => c.name.toLowerCase() === cat.name.toLowerCase()) || {
      description: `Collection of ${cat.name} blocks and components.`,
      icon: Layout
    };
    
    return {
      ...config,
      name: cat.name,
      blocks: cat.count,
      originalCategory: cat.originalCategory,
      isDynamic: true
    };
  });

  // 2. Identify remaining hardcoded categories for "Future Blocks"
  const dynamicNames = new Set(dynamicCategories.map(c => c.name.toLowerCase()));
  const staticCategories = CATEGORIES_CONFIG
    .filter(cat => !dynamicNames.has(cat.name.toLowerCase()))
    .map(cat => ({ ...cat, isDynamic: false }));

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-background text-foreground px-4 py-12 md:px-8 md:py-16">
      <section className="mb-20 text-center space-y-6">
        <Skeleton className="h-10 md:h-16 w-64 md:w-96 mx-auto rounded-xl" />
        <div className="space-y-3 mt-4">
          <Skeleton className="h-5 w-full max-w-xl mx-auto rounded-lg" />
          <Skeleton className="h-5 w-3/4 max-w-lg mx-auto rounded-lg" />
        </div>
      </section>

        <section className="max-w-7xl mx-auto space-y-12">
          <div className="flex items-center gap-4">
             <Skeleton className="h-4 w-32 rounded" />
             <div className="h-px flex-1 bg-border/60" />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-background text-foreground px-4 sm:px-8 py-12 md:py-16">
      {/* Header */}
      <section className="mb-20 text-center space-y-6">
        <h1 className="text-4xl md:text-7xl font-extrabold font-serif tracking-tighter">
          UI LIBRARY<span className="text-primary">.</span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg md:text-xl text-muted-foreground font-light">
          Premium blocks and components designed for 
          <br className="hidden sm:block" />
          modern web applications.
        </p>
      </section>

      {/* Dynamic Blocks Section */}
      <section className="max-w-7xl mx-auto space-y-12">
        <div className="flex items-center gap-4">
           <h2 className="text-sm font-bold tracking-[0.2em] uppercase text-primary">Active Registry</h2>
           <div className="h-px flex-1 bg-border/60" />
        </div>
        
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {dynamicCategories.map((category, index) => (
            <Card key={category.name} category={category} index={index} />
          ))}
        </motion.div>
      </section>

      {/* Static / Future Blocks Section */}
      {staticCategories.length > 0 && (
        <section className="max-w-7xl mx-auto mt-32 space-y-12">
          <div className="flex items-center gap-4">
             <h2 className="text-sm font-bold tracking-[0.2em] uppercase text-muted-foreground">Coming Soon</h2>
             <div className="h-px flex-1 bg-border/60" />
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {staticCategories.map((category, index) => (
              <Card key={category.name} category={category} index={index + dynamicCategories.length} />
            ))}
          </motion.div>
        </section>
      )}
    </div>
  );
}

function Card({ category, index }: { category: any; index: number }) {
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 50 } as any },
  };

  const [isHovered, setIsHovered] = React.useState(false);

  const Preview = PREVIEWS[category.name] || 
                  PREVIEWS[category.name.charAt(0).toUpperCase() + category.name.slice(1).toLowerCase()] || 
                  PREVIEWS[category.name.toUpperCase()] ||
                  AIPreview; 

  const CardContent = (
    <motion.div
      variants={itemVariants}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-all duration-300 hover:border-primary/40 hover:shadow-sm cursor-pointer"
    >
      <div className="h-44 w-full border-b border-border/40 relative bg-muted/5 group-hover:bg-muted/10 transition-colors">
        <Preview isHovered={isHovered} />
        
        <div className="absolute top-3 right-3 z-10 font-mono text-[10px] text-muted-foreground/60 bg-background/90 backdrop-blur px-2 py-1 rounded-md border border-border/40 shadow-sm">
          {String(index + 1).padStart(2, "0")}
        </div>
      </div>

      <div className="p-5 flex flex-col flex-grow">
        <div className="mb-4">
          <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            {category.name}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
            {category.description}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          <Badge variant="secondary" className="bg-muted text-[10px] font-medium text-muted-foreground/80 px-2 py-0.5 border border-border/50">
            {category.blocks} Components
          </Badge>
          
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
            <span>Explore</span>
            <ArrowUpRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </div>
      </div>
    </motion.div>
  );

  // Only link dynamic categories
  if (category.isDynamic) {
    return (
      <Link href={`/docs/${category.originalCategory || "hero"}`} className="h-full">
        {CardContent}
      </Link>
    );
  }

  return (
    <div className="h-full cursor-default grayscale-[0.1] opacity-90 transition-all hover:opacity-100">
      {CardContent}
    </div>
  );
}
function CardSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="h-44 w-full border-b border-border/40 relative bg-muted/5 p-12 flex items-center justify-center">
        <div className="w-full h-full border-2 border-dashed border-primary/5 rounded-lg opacity-20" />
      </div>
      <div className="p-5 flex flex-col flex-grow">
        <div className="mb-4 space-y-3">
          <Skeleton className="h-7 w-3/4" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}
