"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Github, Twitter, Linkedin, Facebook } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full py-12 md:py-16 bg-muted/30 border-t">
      <div className="container px-4 sm:px-6 mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-12 mb-12 text-left">
          <div className="space-y-4">
            <h3 className="text-xl font-bold tracking-tight">SHADWAY<span className="text-primary">.</span></h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[240px]">
              Premium UI components and blocks for modern web applications. 
              Built with React, Tailwind, and Love.
            </p>
            <div className="flex items-center gap-4">
              {[Twitter, Github, Linkedin, Facebook].map((Icon, i) => (
                <Icon key={i} className="w-5 h-5 text-muted-foreground hover:text-primary cursor-pointer transition-colors" />
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-5 text-xs uppercase tracking-widest text-foreground/70">Product</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="hover:text-primary cursor-pointer transition-colors">Components</li>
              <li className="hover:text-primary cursor-pointer transition-colors">Templates</li>
              <li className="hover:text-primary cursor-pointer transition-colors">Showcase</li>
              <li className="hover:text-primary cursor-pointer transition-colors">Pricing</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-5 text-xs uppercase tracking-widest text-foreground/70">Support</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="hover:text-primary cursor-pointer transition-colors">Documentation</li>
              <li className="hover:text-primary cursor-pointer transition-colors">Help Center</li>
              <li className="hover:text-primary cursor-pointer transition-colors">Community</li>
              <li className="hover:text-primary cursor-pointer transition-colors">Status</li>
            </ul>
          </div>

          <div className="space-y-5">
            <h4 className="font-semibold text-xs uppercase tracking-widest text-foreground/70">Join our newsletter</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Get the latest updates on new components and features.
            </p>
            <div className="flex flex-col gap-2 max-w-sm sm:max-w-none">
              <Input placeholder="Enter your email" className="bg-background h-10" />
              <Button className="w-full font-semibold">Subscribe</Button>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-6 text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
          <p>© {currentYear} Shadway Inc. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <span className="hover:text-primary cursor-pointer transition-colors">Privacy Policy</span>
            <span className="hover:text-primary cursor-pointer transition-colors">Terms of Service</span>
            <span className="hover:text-primary cursor-pointer transition-colors">Cookies</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
