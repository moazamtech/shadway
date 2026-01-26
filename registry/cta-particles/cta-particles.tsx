"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CtaParticles() {
  return (
    <section className="py-24 px-4 relative overflow-hidden flex items-center justify-center min-h-[500px] rounded-3xl my-8 mx-4 md:mx-8 border border-border/50 bg-foreground/5 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">

      {/* Dynamic Background Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{
              opacity: 0,
              scale: 0,
              x: Math.random() * 1000 - 500,
              y: Math.random() * 1000 - 500
            }}
            animate={{
              opacity: [0, 0.5, 0],
              scale: [0, 1.5, 0],
              x: Math.random() * 1000 - 500,
              y: Math.random() * 1000 - 500
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 2
            }}
            className="absolute top-1/2 left-1/2 w-1 h-1 bg-primary rounded-full blur-[1px]"
          />
        ))}
      </div>

      <div className="relative z-10 text-center max-w-3xl space-y-8 p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium"
        >
          <Sparkles className="w-4 h-4" />
          <span>Launch Week Deal</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl md:text-6xl font-black tracking-tighter"
        >
          Build better products <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">faster than ever.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto"
        >
          Stop wrestling with UI libraries. Get the best components, animations, and blocks for your next big idea.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button size="lg" className="h-12 px-8 text-base rounded-full shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transition-all">
            Get Started Now
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
          <Button variant="outline" size="lg" className="h-12 px-8 text-base rounded-full border-primary/20 hover:bg-primary/5">
            View Documentation
          </Button>
        </motion.div>
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
    </section>
  );
}

export default CtaParticles;
