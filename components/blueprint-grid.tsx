"use client";

import React from "react";
import { motion } from "framer-motion";

export function BlueprintGrid() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none bg-background">
      {/* Sleek Minimal Technical Grid - Increased Visibility */}
      <div
        className="absolute inset-0 opacity-[0.12] dark:opacity-[0.18]"
        style={{
          backgroundImage: `
            radial-gradient(currentColor 0.5px, transparent 0.5px)
          `,
          backgroundSize: "16px 16px",
        }}
      />

      {/* Subtle Structural Lines - Increased Visibility */}
      <div
        className="absolute inset-0 opacity-[0.05] dark:opacity-[0.08]"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: "128px 128px",
        }}
      />

      {/* Frame Accent */}
      <div className="absolute inset-0 border border-foreground/5" />
    </div>
  );
}
