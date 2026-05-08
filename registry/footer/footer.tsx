"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Github, Twitter, Linkedin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const links = {
  Product: ["Components", "Templates", "Showcase", "Pricing"],
  Resources: ["Documentation", "Changelog", "Blog", "Status"],
  Company: ["About", "Careers", "Contact", "Press"],
};

const socials = [
  { icon: Twitter, label: "Twitter" },
  { icon: Github, label: "GitHub" },
  { icon: Linkedin, label: "LinkedIn" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full bg-background text-foreground border-t border-border/40">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 border-b border-border/40">
        <div className="grid grid-cols-1 lg:grid-cols-2 border-l border-border/40">
          {/* Brand + tagline */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="border-r border-border/40 py-16 px-8 md:px-12 space-y-6"
          >
            <div>
              <h2 className="text-3xl md:text-5xl font-medium tracking-tight leading-[0.9]">
                SHADWAY
                <span className="text-primary">.</span>
              </h2>
              <p className="mt-4 text-muted-foreground/60 font-light leading-relaxed max-w-xs">
                Premium UI blocks built with Shadcn UI, Tailwind CSS, and Framer Motion. Drop in, customize, ship.
              </p>
            </div>

            <div className="flex items-center gap-4">
              {socials.map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  aria-label={label}
                  className="p-2.5 border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 group"
                >
                  <Icon className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          </motion.div>

          {/* Newsletter */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="py-16 px-8 md:px-12 flex flex-col justify-center gap-6"
          >
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground/50 mb-3">Newsletter</p>
              <h3 className="text-xl font-medium tracking-tight">
                Stay in the loop
              </h3>
              <p className="mt-2 text-sm text-muted-foreground/60 font-light">
                New components, templates, and updates — delivered weekly.
              </p>
            </div>
            <div className="flex gap-2 max-w-sm">
              <Input
                placeholder="your@email.com"
                className="rounded-none border-border/40 bg-transparent h-11 focus:border-primary/60 flex-1"
              />
              <Button
                className="h-11 px-6 rounded-none font-bold uppercase tracking-widest text-[11px]"
              >
                Subscribe
                <ArrowUpRight className="ml-1.5 w-3.5 h-3.5" />
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Links grid */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 border-b border-border/40">
        <div className="grid grid-cols-3 border-l border-border/40">
          {Object.entries(links).map(([section, items], i) => (
            <motion.div
              key={section}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="border-r border-border/40 py-10 px-8 md:px-10"
            >
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground/50 mb-6">{section}</p>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item}>
                    <span className="text-sm text-muted-foreground/70 hover:text-foreground cursor-pointer transition-colors font-light">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
          <p className="text-[11px] text-muted-foreground/40 font-mono">
            © {year} Shadway Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-[11px] text-muted-foreground/40">
            {["Privacy Policy", "Terms of Service", "Cookies"].map((item) => (
              <span key={item} className="hover:text-muted-foreground/70 cursor-pointer transition-colors">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
