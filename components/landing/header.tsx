"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Github, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_LINKS = [
  { label: "Library", href: "/docs" },
  { label: "Generator", href: "/component-generator" },
  { label: "Vibecode", href: "/vibecode" },
  { label: "Directory", href: "/directory" },
];

export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="relative z-50">
      <div className="flex h-16 items-center justify-between px-6 lg:px-12">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" width={22} height={22} alt="Shadway" />
          <span className="font-serif text-lg tracking-tight">Shadway</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            asChild
          >
            <Link
              href="https://github.com/moazamtech/shadway"
              target="_blank"
              rel="noreferrer"
            >
              <Github className="h-4 w-4" />
            </Link>
          </Button>
          <ThemeToggle />
          <Button size="sm" className="rounded-full px-4" asChild>
            <Link href="/component-generator">Start</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="h-px bg-border" />

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="absolute inset-x-0 top-full z-50 border-b border-border bg-background md:hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <nav className="flex flex-col gap-1 px-6 py-4">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="https://github.com/moazamtech/shadway"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                <Github className="h-4 w-4" />
                GitHub
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
