import { type ReactNode, useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  GrainGradient,
  StaticRadialGradient,
  Dithering,
  GodRays,
} from "@paper-design/shaders-react";
import React from "react";

export function HatchedSeparator() {
  return (
    <div className="relative flex flex-col">
      <div className="w-full border-b border-dashed border-border" />
      <div className="h-4 w-full bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,var(--color-border)_4px,var(--color-border)_5px)] opacity-20" />
      <div className="w-full border-b border-dashed border-border" />
      {/* Rail junction nodes — 4-pointed stars */}
      <div className="absolute left-[9px] top-1/2 -translate-x-1/2 -translate-y-1/2">
        <svg
          width="14"
          height="14"
          viewBox="0 0 10 10"
          className="text-foreground/25"
        >
          <path
            d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="absolute right-[9px] top-1/2 translate-x-1/2 -translate-y-1/2">
        <svg
          width="14"
          height="14"
          viewBox="0 0 10 10"
          className="text-foreground/25"
        >
          <path
            d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </div>
  );
}

export function DashedSeparator() {
  return <div className="w-full border-b border-dashed border-border" />;
}

export function OutsideRailMotif({
  className,
  duration = 8,
  delay = 0,
  rotate = 6,
  y = 10,
  children,
}: {
  className: string;
  duration?: number;
  delay?: number;
  rotate?: number;
  y?: number;
  children: ReactNode;
}) {
  return (
    <motion.svg
      aria-hidden="true"
      viewBox="0 0 220 220"
      className={className}
      animate={{
        y: [0, -y, 0],
        rotate: [0, rotate, 0],
        opacity: [0.5, 0.9, 0.5],
      }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.svg>
  );
}

export function TechnicalGrid() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  const colors = isDark
    ? ["#2596be", "#0154a5", "#0241a7"]
    : ["#0154a5", "#0154a5", "#0241a7"];
  const colorBack = isDark ? "#0a0a0a" : "#ffffff";

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Layer 1: Base Aesthetic (Synced with Hero color logic) */}
      {mounted && (
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-40 dark:opacity-60">
            <GrainGradient
              width="100%"
              height="100%"
              colors={colors}
              colorBack={colorBack}
              softness={0.8}
              intensity={0.25}
              noise={0.35}
              shape="corners" // Technical 'Corners' pattern to distinguish from Landing
              speed={0.4}
            />
          </div>

          {/* Layer 1b: Signature Nodal Warp overlay */}
          <div className="absolute inset-0 opacity-[0.2] dark:opacity-[0.3]">
            <Dithering
              width="100%"
              height="100%"
              colorBack="#00000000"
              colorFront={colors[1]}
              shape="warp"
              type="4x4"
              size={2.5}
              speed={0.2}
            />
          </div>
        </div>
      )}

      {/* Layer 2: The Nodal Grid — Custom blueprint markers */}
      <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.15]">
        <svg width="100%" height="100%" className="w-full h-full">
          <defs>
            <pattern
              id="blueprint-nodes"
              x="0"
              y="0"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              {/* Main Intersection Crosshair */}
              <circle
                cx="40"
                cy="40"
                r="1.5"
                fill="currentColor"
                opacity="0.4"
              />
              <line
                x1="40"
                y1="35"
                x2="40"
                y2="45"
                stroke="currentColor"
                strokeWidth="0.5"
              />
              <line
                x1="35"
                y1="40"
                x2="45"
                y2="40"
                stroke="currentColor"
                strokeWidth="0.5"
              />

              {/* Corner Brackets */}
              <path
                d="M0 5 V0 H5"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                opacity="0.3"
              />
              <path
                d="M75 0 H80 V5"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                opacity="0.3"
              />
              <path
                d="M80 75 V80 H75"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                opacity="0.3"
              />
              <path
                d="M5 80 H0 V75"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                opacity="0.3"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#blueprint-nodes)" />
        </svg>
      </div>

      {/* Layer 3: Scanning Horizontal Beam — Subtly moves across the workspace */}
      <motion.div
        className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-primary/20 to-transparent"
        animate={{ y: ["0%", "400%"] }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      />

      {/* Vignette/Fade */}
      <div className="absolute inset-0 bg-linear-to-b from-background/20 via-transparent to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,transparent_0%,var(--color-background)_100%)] opacity-30" />
    </div>
  );
}

export function BlueprintLine({
  className,
  vertical,
}: {
  className?: string;
  vertical?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative opacity-20",
        vertical ? "h-full w-px px-[2px]" : "w-full h-px py-[2px]",
        className,
      )}
    >
      <div
        className={cn("bg-primary h-full w-full", vertical ? "w-px" : "h-px")}
      />
      <div
        className={cn(
          "absolute bg-primary rounded-full size-1",
          vertical
            ? "top-0 left-1/2 -translate-x-1/2"
            : "left-0 top-1/2 -translate-y-1/2",
        )}
      />
      <div
        className={cn(
          "absolute bg-primary rounded-full size-1",
          vertical
            ? "bottom-0 left-1/2 -translate-x-1/2"
            : "right-0 top-1/2 -translate-y-1/2",
        )}
      />
    </div>
  );
}

import { cn } from "@/lib/utils";
