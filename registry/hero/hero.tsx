"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative w-full py-16 sm:py-20 lg:py-24 flex items-center justify-center overflow-hidden bg-background">
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.12] dark:opacity-[0.18] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, var(--foreground) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Vertical rails */}
      <div className="absolute inset-y-0 left-[10%] w-px bg-border/30 pointer-events-none hidden md:block" />
      <div className="absolute inset-y-0 right-[10%] w-px bg-border/30 pointer-events-none hidden md:block" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 w-full">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          {/* Label */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.3em] uppercase text-primary/80"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Premium UI Blocks
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-6xl md:text-8xl lg:text-[9rem] font-medium tracking-tight leading-[0.9]"
          >
            Build faster,
            <br />
            <span className="text-muted-foreground/35 font-serif italic">
              ship better.
            </span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground/80 font-light leading-relaxed"
          >
            A curated collection of production-ready UI blocks built with
            Shadcn, Tailwind CSS, and Framer Motion. Drop-in, customize, ship.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              size="lg"
              className="h-12 px-10 text-sm font-bold uppercase tracking-widest rounded-none"
            >
              Browse Blocks
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-10 text-sm font-bold uppercase tracking-widest rounded-none border-border/40"
            >
              View Source
            </Button>
          </motion.div>

          {/* Tech stack chips */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-3 pt-4"
          >
            {["Shadcn UI", "Tailwind CSS", "Framer Motion", "TypeScript", "Next.js"].map(
              (tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/50 border border-border/30 px-3 py-1.5 bg-muted/10"
                >
                  {tag}
                </span>
              )
            )}
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="flex items-center justify-center gap-8 md:gap-16 pt-8 border-t border-border/20"
          >
            {[
              { value: "50+", label: "Blocks" },
              { value: "7", label: "Categories" },
              { value: "Free", label: "Open Source" },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-2xl md:text-3xl font-bold tracking-tight">
                  {stat.value}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-bold">
                  {stat.label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </section>
  );
}

export default Hero;
