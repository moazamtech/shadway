"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send } from "lucide-react";

export function Contact() {
  return (
    <section className="w-full py-16 md:py-24 bg-background">
      <div className="container px-4 sm:px-6 mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start text-left">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight">Get in touch</h2>
              <p className="text-base sm:text-lg text-muted-foreground font-light leading-relaxed">
                Have a project in mind? We'd love to hear from you. 
                Our team usually responds within 24 hours.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-6">
              {[
                { icon: Mail, title: "Email us", detail: "hello@shadway.online" },
                { icon: Phone, title: "Call us", detail: "+1 (555) 000-0000" },
                { icon: MapPin, title: "Visit us", detail: "123 Design St, San Francisco, CA" }
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-xl border bg-card/50 transition-colors hover:bg-card">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm sm:text-base">{item.title}</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 sm:p-8 rounded-2xl border bg-card shadow-xl space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="first-name" className="text-xs sm:text-sm">First name</Label>
                <Input id="first-name" placeholder="John" className="h-10 sm:h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name" className="text-xs sm:text-sm">Last name</Label>
                <Input id="last-name" placeholder="Doe" className="h-10 sm:h-11" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs sm:text-sm">Email</Label>
              <Input id="email" type="email" placeholder="john@example.com" className="h-10 sm:h-11" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message" className="text-xs sm:text-sm">Message</Label>
              <Textarea id="message" placeholder="Tell us about your project..." rows={4} className="resize-none" />
            </div>

            <Button className="w-full h-11 sm:h-12 gap-2 text-base font-semibold shadow-lg shadow-primary/20">
              <Send className="w-4 h-4" />
              Send Message
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
