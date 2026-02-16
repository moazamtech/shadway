"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function RegistryBlockSkeleton() {
  return (
    <div className="group relative flex flex-col space-y-0 transition-all duration-300">
      {/* Header Skeleton */}
      <div className="relative py-4 px-6 md:px-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <Skeleton className="h-px w-8 bg-primary/20" />
            <Skeleton className="h-3 w-32 rounded-none opacity-40" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-12 w-64 md:h-16 md:w-96 rounded-none" />
          </div>
          <div className="pt-4 mt-4 border-t border-border/40">
            <Skeleton className="h-4 w-full max-w-md rounded-none opacity-40" />
          </div>
        </div>

        {/* Info Items Skeleton */}
        <div className="flex items-center gap-6 pb-2">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-2 w-16 rounded-none opacity-30" />
            <Skeleton className="h-4 w-24 rounded-none" />
          </div>
          <div className="w-px h-8 bg-border/40" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-2 w-16 rounded-none opacity-30" />
            <Skeleton className="h-4 w-24 rounded-none" />
          </div>
        </div>
      </div>

      {/* Main Preview Area Skeleton */}
      <div className="relative border-y border-border/40 overflow-hidden bg-background h-[600px] flex items-center justify-center">
        {/* Minimal Dot Grid Placeholder */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(currentColor 1.5px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6">
          <Skeleton className="w-64 h-64 rounded-none opacity-20" />
          <div className="flex gap-3">
            <Skeleton className="h-9 w-24 rounded-none opacity-40" />
            <Skeleton className="h-9 w-24 rounded-none opacity-40" />
          </div>
        </div>

        <div className="absolute top-4 right-4 flex gap-2">
          <Skeleton className="h-8 w-8 rounded-none opacity-30" />
          <Skeleton className="h-8 w-8 rounded-none opacity-30" />
          <Skeleton className="h-8 w-8 rounded-none opacity-30" />
        </div>
      </div>

      {/* Footer Actions Skeleton */}
      <div className="py-6 px-6 md:px-12 flex items-center justify-between">
        <Skeleton className="h-10 w-48 rounded-none opacity-40" />
        <div className="flex gap-6">
          <Skeleton className="h-3 w-16 rounded-none opacity-30" />
          <Skeleton className="h-3 w-16 rounded-none opacity-30" />
        </div>
      </div>
    </div>
  );
}
