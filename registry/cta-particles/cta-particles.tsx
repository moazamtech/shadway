"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// Deterministic particle positions — avoids hydration mismatch from Math.random() in render
const PARTICLES = Array.from({ length: 24 }, (_, i) => {
  const angle = (i / 24) * Math.PI * 2;
  const r = 120 + (i % 6) * 60;
  return {
    id: i,
    x: Math.cos(angle) * r,
    y: Math.sin(angle) * r,
    tx: Math.cos(angle + 0.8) * (r + 80),
    ty: Math.sin(angle + 0.8) * (r + 80),
    duration: 2.5 + (i % 5) * 0.4,
    delay: (i * 0.12) % 2.2,
  };
});

export function CtaParticles() {
  return (
    <section className="relative w-full overflow-hidden flex items-center justify-center bg-background py-20 md:py-28 px-4">
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)/20_1px,transparent_1px),linear-gradient(to_bottom,var(--border)/20_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Radial fade over grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,transparent_30%,var(--background)_100%)] pointer-events-none" />

      {/* Center glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, scale: 0, x: p.x, y: p.y }}
            animate={{
              opacity: [0, 0.7, 0],
              scale: [0, 1.2, 0],
              x: [p.x, p.tx],
              y: [p.y, p.ty],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: "easeInOut",
            }}
            className="absolute w-1 h-1 bg-primary rounded-full"
          />
        ))}
      </div>

      <div className="relative z-10 text-center max-w-3xl space-y-8 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-3 py-1 border border-primary/30 bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-[0.2em]"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Launch Week Deal
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-medium tracking-tight leading-[0.9]"
        >
          Build better products
          <br />
          <span className="text-muted-foreground/35 font-serif italic">
            faster than ever.
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg text-muted-foreground/80 max-w-xl mx-auto font-light leading-relaxed"
        >
          Stop wrestling with UI libraries. Get the best components, animations,
          and blocks for your next big idea.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button
            size="lg"
            className="h-12 px-10 text-sm font-bold uppercase tracking-widest rounded-none"
          >
            Get Started Now
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-12 px-10 text-sm font-bold uppercase tracking-widest rounded-none border-border/40"
          >
            View Documentation
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

export default CtaParticles;
