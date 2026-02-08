"use client";

import { useEffect, useState } from "react";
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
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const trigger = document.getElementById("hero-sticky-trigger");
    if (!trigger) {
      setIsSticky(false);
      return;
    }

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          setIsSticky(!entry.isIntersecting);
        },
        { root: null, threshold: 0, rootMargin: "-72px 0px 0px 0px" },
      );

      observer.observe(trigger);
      return () => observer.disconnect();
    }

    const onScroll = () => {
      const top = trigger.getBoundingClientRect().top;
      setIsSticky(top <= 72);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Default header — visible at top of page */}
      <header
        className={`relative z-50 transition-opacity duration-300 ${
          isSticky ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex h-16 items-center justify-between bg-background px-6 md:bg-transparent lg:px-12">
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
              <Link href="/docs">Docs</Link>
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
          {mobileOpen && !isSticky && (
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

      {/* Floating pill header — appears when scrolled */}
      <AnimatePresence>
        {isSticky && (
          <motion.header
            className="fixed left-1/2 top-4 z-50 -translate-x-1/2"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="relative overflow-hidden rounded-full border border-border/40 bg-background/70 shadow-lg shadow-primary/5 backdrop-blur-xl">
              {/* Top highlight */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

              {/* Desktop floating nav */}
              <div className="hidden items-center gap-1 px-4 py-2 md:flex">
                <Link href="/" className="mr-2 flex items-center">
                  <Image
                    src="/logo.png"
                    width={20}
                    height={20}
                    alt="Shadway"
                  />
                </Link>

                <nav className="flex items-center gap-0.5">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>

                <div className="ml-2 flex items-center gap-1.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <Link
                      href="https://github.com/moazamtech/shadway"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Github className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <ThemeToggle />
                  <Button size="sm" className="h-7 rounded-full px-3 text-xs" asChild>
                    <Link href="/docs">Docs</Link>
                  </Button>
                </div>
              </div>

              {/* Mobile floating nav */}
              <div className="flex items-center gap-2 px-4 py-2 md:hidden">
                <Link href="/" className="flex items-center">
                  <Image
                    src="/logo.png"
                    width={20}
                    height={20}
                    alt="Shadway"
                  />
                </Link>

                <div className="ml-auto flex items-center gap-1.5">
                  <ThemeToggle />
                  <Button size="sm" className="h-7 rounded-full px-3 text-xs" asChild>
                    <Link href="/docs">Docs</Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setMobileOpen(!mobileOpen)}
                  >
                    {mobileOpen ? (
                      <X className="h-3.5 w-3.5" />
                    ) : (
                      <Menu className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Mobile dropdown for floating state */}
            <AnimatePresence>
              {mobileOpen && (
                <motion.div
                  className="mt-2 overflow-hidden rounded-2xl border border-border/40 bg-background/70 shadow-lg shadow-primary/5 backdrop-blur-xl md:hidden"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <nav className="flex flex-col gap-1 px-4 py-3">
                    {NAV_LINKS.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                        onClick={() => setMobileOpen(false)}
                      >
                        {link.label}
                      </Link>
                    ))}
                    <Link
                      href="https://github.com/moazamtech/shadway"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                      onClick={() => setMobileOpen(false)}
                    >
                      <Github className="h-4 w-4" />
                      GitHub
                    </Link>
                  </nav>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.header>
        )}
      </AnimatePresence>
    </>
  );
}
