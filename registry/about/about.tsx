"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { CheckCircle2, Trophy, Users, Rocket } from "lucide-react";

export function About() {
  const stats = [
    { label: "Founded", value: "2024", icon: Rocket },
    { label: "Clients", value: "500+", icon: Users },
    { label: "Awards", value: "12", icon: Trophy },
  ];

  const features = [
    "Pixel perfect design implementation",
    "Highly optimized for performance",
    "Accessibility first approach (a11y)",
    "Fully customizable via Tailwind CSS",
  ];

  return (
    <section className="w-full py-16 md:py-24 bg-background overflow-hidden text-left">
      <div className="container px-4 sm:px-6 mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          <div className="w-full lg:w-1/2 space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-[1.2]">
                Crafting interfaces that <span className="text-primary italic">matter.</span>
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground font-light leading-relaxed">
                At Shadway, we believe that every pixel has a purpose. 
                Our team of designers and engineers work tirelessly to bring 
                you the highest quality React components for your next big idea.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {features.map((feature, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-sm font-medium">{feature}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
              <Button size="lg" className="w-full sm:w-auto px-8">Learn More</Button>
              <Button size="lg" variant="ghost" className="w-full sm:w-auto">Meet the team</Button>
            </div>
          </div>

          <div className="w-full lg:w-1/2 relative mt-12 lg:mt-0">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative aspect-square sm:aspect-[4/3] lg:aspect-square rounded-3xl bg-muted border overflow-hidden shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                 <span className="text-muted-foreground font-mono text-[10px] sm:text-sm opacity-20 italic p-6 text-center">
                   Company Image Placeholder
                 </span>
              </div>
            </motion.div>

            {/* Stats Overlay - Fluid version */}
            <div className="absolute -bottom-6 -left-4 sm:-bottom-10 sm:-left-10 flex flex-col gap-3 sm:gap-4 p-4 sm:p-6 rounded-2xl border bg-card shadow-xl z-10 scale-90 sm:scale-100 origin-bottom-left max-w-[160px] sm:max-w-none">
              {stats.map((stat, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <stat.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] sm:text-xs text-muted-foreground uppercase tracking-wider font-bold truncate">{stat.label}</p>
                    <p className="text-xs sm:text-sm font-bold">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
