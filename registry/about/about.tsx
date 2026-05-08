"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Globe, Zap, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const stats = [
  { value: "2024", label: "Founded" },
  { value: "500+", label: "Clients" },
  { value: "12", label: "Awards" },
  { value: "99%", label: "Satisfaction" },
];

const pillars = [
  { icon: Globe, title: "Global Reach", desc: "Serving teams across 40+ countries with localized, accessible components." },
  { icon: Zap, title: "Performance First", desc: "Every block is optimized for Core Web Vitals and zero layout shift." },
  { icon: ShieldCheck, title: "Accessibility", desc: "WCAG 2.1 AA compliant. Built with semantic HTML and ARIA from the ground up." },
  { icon: Users, title: "Community Driven", desc: "Open source, community-maintained, and designed to evolve with modern needs." },
];

export function About() {
  return (
    <section className="relative w-full bg-background text-foreground overflow-hidden">
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.1] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, var(--foreground) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto w-full px-6 lg:px-12 py-16 sm:py-20 lg:py-24">
        {/* Vertical rails — pinned to content edge, aligned with grid borders */}
        <div className="absolute inset-y-0 left-6 lg:left-12 w-px bg-border/30 pointer-events-none hidden lg:block" />
        <div className="absolute inset-y-0 right-6 lg:right-12 w-px bg-border/30 pointer-events-none hidden lg:block" />
        {/* Top header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-16 border-b border-border/40 px-4">
          <div className="space-y-4 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.3em] uppercase text-primary/80"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Who We Are
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-medium tracking-tight leading-[0.9]"
            >
              Crafting interfaces
              <br />
              <span className="text-muted-foreground/35 font-serif italic">that matter.</span>
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="max-w-sm text-muted-foreground/70 font-light leading-relaxed text-lg md:text-right"
          >
            We believe every pixel has a purpose. Our components are precision-crafted for teams that care about craft.
          </motion.p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border/40">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex flex-col gap-1 px-8 py-10 border-r border-border/40 last:border-r-0 odd:border-r"
            >
              <span className="text-4xl md:text-5xl font-bold tracking-tight">{stat.value}</span>
              <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60 font-bold">{stat.label}</span>
            </motion.div>
          ))}
        </div>

        {/* Pillars grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-l border-border/40">
          {pillars.map((pillar, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="group relative border-r border-b border-border/40 p-8 md:p-10 hover:bg-muted/5 transition-colors duration-300"
            >
              <div className="flex flex-col gap-6">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 w-fit border border-border/50 group-hover:border-primary/30 group-hover:bg-primary/5 transition-all duration-300">
                    <pillar.icon className="w-5 h-5 text-foreground/60 group-hover:text-primary transition-colors" />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-border/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300 flex-shrink-0 mt-2.5" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight">{pillar.title}</h3>
                  <p className="text-sm text-muted-foreground/70 leading-relaxed font-light">{pillar.desc}</p>
                </div>
                <div className="h-px mt-auto bg-border/20 overflow-hidden">
                  <motion.div
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "0%" }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="h-full bg-primary"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <div className="pt-16 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <Button
            size="lg"
            className="h-12 px-10 text-sm font-bold uppercase tracking-widest rounded-none"
          >
            Meet the Team
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 px-10 text-sm font-bold uppercase tracking-widest rounded-none border-border/40"
          >
            View Open Roles
          </Button>
        </div>
      </div>
    </section>
  );
}

export default About;
