"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const contactInfo = [
  { icon: Mail, label: "Email", value: "hello@shadway.online" },
  { icon: Phone, label: "Phone", value: "+1 (555) 000-0000" },
  { icon: MapPin, label: "Office", value: "123 Design St, San Francisco, CA" },
];

export function Contact() {
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
        <div className="absolute inset-y-0 left-6 lg:left-12 w-px bg-border/30 pointer-events-none hidden lg:block" />
        <div className="absolute inset-y-0 right-6 lg:right-12 w-px bg-border/30 pointer-events-none hidden lg:block" />
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
              Get In Touch
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-medium tracking-tight leading-[0.9]"
            >
              Let&apos;s work
              <br />
              <span className="text-muted-foreground/35 font-serif italic">together.</span>
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="max-w-sm text-muted-foreground/70 font-light leading-relaxed text-lg md:text-right"
          >
            Have a project in mind? Our team usually responds within 24 hours. Let&apos;s build something great.
          </motion.p>
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 border-l border-border/40">
          {/* Left: contact info */}
          <div className="border-r border-border/40 p-8 md:p-12 flex flex-col gap-10">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground/50">Contact Details</p>
            </div>

            <div className="flex flex-col gap-0 border-t border-border/40">
              {contactInfo.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="group flex items-center gap-6 py-7 border-b border-border/40 hover:bg-muted/5 transition-colors -mx-8 md:-mx-12 px-8 md:px-12"
                >
                  <div className="p-2.5 border border-border/50 group-hover:border-primary/30 group-hover:bg-primary/5 transition-all duration-300 flex-shrink-0">
                    <item.icon className="w-4 h-4 text-foreground/60 group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground/50 mb-1">{item.label}</p>
                    <p className="text-sm font-medium">{item.value}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-auto pt-4">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground/40 mb-4">Response time</p>
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm text-muted-foreground/70">Usually within 24 hours</span>
              </div>
            </div>
          </div>

          {/* Right: form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="p-8 md:p-12 flex flex-col gap-6"
          >
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground/50">Send a Message</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-1">
                <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60">First Name</Label>
                <Input placeholder="John" className="rounded-none border-border/40 bg-transparent h-11 focus:border-primary/60" />
              </div>
              <div className="space-y-2 col-span-1">
                <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60">Last Name</Label>
                <Input placeholder="Doe" className="rounded-none border-border/40 bg-transparent h-11 focus:border-primary/60" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60">Email Address</Label>
              <Input type="email" placeholder="john@example.com" className="rounded-none border-border/40 bg-transparent h-11 focus:border-primary/60" />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60">Subject</Label>
              <Input placeholder="Project inquiry" className="rounded-none border-border/40 bg-transparent h-11 focus:border-primary/60" />
            </div>

            <div className="space-y-2 flex-1">
              <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60">Message</Label>
              <Textarea
                placeholder="Tell us about your project..."
                rows={5}
                className="rounded-none border-border/40 bg-transparent resize-none focus:border-primary/60"
              />
            </div>

            <Button
              size="lg"
              className="h-12 px-10 text-sm font-bold uppercase tracking-widest rounded-none w-full"
            >
              Send Message
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default Contact;
