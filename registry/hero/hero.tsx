"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function Hero() {
  return (
    <section className="relative w-full py-20 md:py-32 overflow-hidden bg-background">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -z-10" />
      
      <div className="container px-4 mx-auto text-center space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary"
        >
          <span className="flex h-2 w-2 rounded-full bg-primary mr-2" />
          New Component Library Released
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-[1.1]"
        >
          Build Faster with <br />
          <span className="text-primary italic">Premium Blocks</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground font-light leading-relaxed"
        >
          A curated collection of secondary-to-none UI components and blocks 
          built with Tailwind CSS and Framer Motion. Shadcn compatible.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button size="lg" className="h-12 px-8 text-base">
            Get Started Free
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-8 text-base">
            View Components
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-16 relative mx-auto max-w-5xl rounded-2xl border border-border bg-card/50 p-2 shadow-2xl overflow-hidden"
        >
           <div className="aspect-video rounded-xl bg-muted animate-pulse flex items-center justify-center">
              <span className="text-muted-foreground font-mono text-sm opacity-20 italic">
                Dashboard Preview Placeholder
              </span>
           </div>
        </motion.div>
      </div>
    </section>
  );
}
