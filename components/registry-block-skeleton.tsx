"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function RegistryBlockSkeleton() {
  return (
    <div className="group relative flex flex-col space-y-0 py-16">
      {/* Header Skeleton */}
      <div className="relative py-8 flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-visible border-t border-dashed border-border">
        {/* Massive Ghost Number Skeleton (Optional, but let's add a light placeholder) */}
        <div className="absolute -left-4 -top-8 w-32 h-20 bg-foreground/[0.02] rounded-lg hidden md:block" />

        <div className="flex flex-col gap-3 relative z-10 px-1">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-12 rounded bg-primary/10 border border-dashed border-primary/20 md:hidden" />
            <Skeleton className="h-10 w-64 md:h-12 md:w-96 rounded-lg" />
          </div>
          <div className="space-y-2 mt-1">
            <Skeleton className="h-4 w-full max-w-xl rounded" />
            <Skeleton className="h-4 w-3/4 max-w-md rounded" />
          </div>
        </div>

        {/* View Switchers Skeleton */}
        <div className="flex items-center gap-2 p-1.5 bg-muted/20 rounded-xl border border-dashed border-border z-10">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <div className="h-4 w-px bg-border/40 mx-1" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Main Content Area Skeleton */}
      <div className="relative border-l border-r border-dashed border-border overflow-hidden bg-background min-h-[500px] flex items-center justify-center">
        <div className="w-full h-full p-20 flex flex-col items-center justify-center space-y-6">
           <Skeleton className="w-full max-w-4xl h-64 rounded-2xl opacity-50" />
           <div className="flex gap-4">
              <Skeleton className="h-10 w-32 rounded-lg" />
              <Skeleton className="h-10 w-32 rounded-lg" />
           </div>
        </div>
        
        {/* Background Pattern Placeholder */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: `radial-gradient(circle, var(--foreground) 1.5px, transparent 1.5px)`, backgroundSize: '24px 24px' }} />
      </div>

      {/* Footer Skeleton */}
      <div className="border-b border-dashed border-border py-6 px-1 flex flex-col sm:flex-row items-center justify-between gap-6">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <div className="flex items-center gap-8">
           <Skeleton className="h-4 w-12 rounded" />
           <Skeleton className="h-4 w-12 rounded" />
           <Skeleton className="h-4 w-12 rounded" />
        </div>
      </div>
    </div>
  );
}
