"use client";

import React from "react";

export function BlueprintGrid() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none bg-background">
      {/* Clean Large-Dot Grid */}
      <div
        className="absolute inset-0 opacity-[0.12] dark:opacity-[0.18]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 1.5px 1.5px, currentColor 1.5px, transparent 0)
          `,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Primary Light Accent */}
      <div className="absolute inset-0 bg-linear-to-tr from-primary/2 via-transparent to-transparent" />

      {/* Edge Structural Lines */}
      <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-foreground/10 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-linear-to-r from-transparent via-foreground/10 to-transparent" />
    </div>
  );
}
