"use client";

import { motion } from "framer-motion";
import { ArrowRight, Globe, Zap, ShieldCheck, BarChart3, Cpu, Layers } from "lucide-react";

const features = [
  {
    number: "01",
    title: "Global Edge Network",
    description: "Deploy to 300+ edge locations worldwide. Sub-50ms latency, guaranteed everywhere.",
    icon: Globe,
  },
  {
    number: "02",
    title: "Instant Auto-Scaling",
    description: "Zero-config scaling from zero to millions of requests with no cold starts.",
    icon: Zap,
  },
  {
    number: "03",
    title: "Enterprise Security",
    description: "Bank-grade encryption, DDoS protection, and SOC2 compliance built in by default.",
    icon: ShieldCheck,
  },
  {
    number: "04",
    title: "Real-time Analytics",
    description: "Track every metric that matters. Live dashboards, instant alerts, zero setup.",
    icon: BarChart3,
  },
  {
    number: "05",
    title: "AI-Powered Insights",
    description: "Intelligent anomaly detection and recommendations surface before you ask.",
    icon: Cpu,
  },
  {
    number: "06",
    title: "Modular Architecture",
    description: "Build with composable primitives. Swap any layer without rewrites.",
    icon: Layers,
  },
];

export function FeaturesBento() {
  return (
    <section className="py-16 sm:py-20 lg:py-24 px-6 lg:px-12 bg-background text-foreground">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-16 border-b border-border/40">
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.3em] uppercase text-primary/80"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Core Features
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-medium tracking-tight leading-[0.9]"
            >
              Everything you need
              <br />
              <span className="text-muted-foreground/35 font-serif italic">to scale.</span>
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="max-w-sm text-muted-foreground/70 font-light leading-relaxed text-lg md:text-right"
          >
            Built for teams that move fast. Infrastructure that disappears into the background.
          </motion.p>
        </div>

        {/* Features grid — border-based, no rounded corners */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-l border-border/40">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="group relative border-r border-b border-border/40 p-8 md:p-10 hover:bg-muted/5 transition-colors duration-300 overflow-hidden"
            >
              {/* Background number — bottom-right so it doesn't overlap the icon row */}
              <div className="absolute bottom-4 right-5 text-[72px] font-black text-foreground/[0.04] leading-none select-none font-mono group-hover:text-primary/[0.06] transition-colors">
                {feature.number}
              </div>

              <div className="relative z-10 flex flex-col gap-8">
                {/* Icon only — arrow moved to bottom accent */}
                <div className="flex items-start">
                  <div className="p-2.5 border border-border/50 group-hover:border-primary/30 group-hover:bg-primary/5 transition-all duration-300">
                    <feature.icon className="w-5 h-5 text-foreground/60 group-hover:text-primary transition-colors" />
                  </div>
                </div>

                {/* Text */}
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold tracking-tight">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground/70 leading-relaxed font-light">
                    {feature.description}
                  </p>
                </div>

                {/* Hover accent line + arrow */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border/20 overflow-hidden">
                    <motion.div
                      initial={{ x: "-100%" }}
                      whileHover={{ x: "0%" }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="h-full bg-primary"
                    />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-border/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300 flex-shrink-0" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeaturesBento;
