"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  GrainGradient,
  StaticRadialGradient,
  Dithering,
  Heatmap,
} from "@paper-design/shaders-react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Boxes,
  CheckCircle2,
  Code2,
  Github,
  Sparkles,
  Star,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TextHoverEffect } from "@/components/site-components/text-hover-effect";
import { VibecodeComponent } from "@/lib/types";
import { CATEGORIES_CONFIG } from "@/lib/docs-config";
import staticRegistry from "@/registry/registry.json";
import { LandingFooter } from "./footer";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type RegistryItem = { name: string; category?: string; type?: string };
type RegistryResponse = { items?: RegistryItem[] };

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const staggerHeading = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.3 } },
};

const wordReveal = {
  hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: [0.25, 0.4, 0.25, 1] },
  },
};

const fadeUp = (delay: number) => ({
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay, ease: [0.25, 0.4, 0.25, 1] },
  },
});

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.4, 0.25, 1] },
  },
};

function normalizeCategoryName(v: string) {
  return v.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function toTitleCase(v: string) {
  return v
    .split(" ")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function formatDate(v: Date | string | undefined) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const CATEGORY_LOOKUP = new Map(
  CATEGORIES_CONFIG.map((c) => [normalizeCategoryName(c.name), c]),
);

const HEATMAP_ICONS = {
  book: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 7h6"/><path d="M8 11h4"/></svg>'),
  wand: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>'),
  boxes: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"/><path d="m7 16.5-4.74-2.85"/><path d="m7 16.5 5-3"/><path d="M7 16.5v5.17"/><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"/><path d="m17 16.5-5-3"/><path d="m17 16.5 4.74-2.85"/><path d="M17 16.5v5.17"/><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"/><path d="M12 8 7.26 5.15"/><path d="m12 8 4.74-2.85"/><path d="M12 13.5V8"/></svg>'),
};

/* ------------------------------------------------------------------ */
/*  Static data                                                        */
/* ------------------------------------------------------------------ */

const GENERATOR_STEPS = [
  {
    title: "Prompt",
    desc: "Describe the UI you want to build in plain language.",
    icon: Sparkles,
  },
  {
    title: "Generate",
    desc: "Get runnable component files and a live preview instantly.",
    icon: WandSparkles,
  },
  {
    title: "Edit",
    desc: "Adjust files directly with Monaco-powered editing.",
    icon: Code2,
  },
  {
    title: "Publish",
    desc: "Push approved work to the public Vibecode gallery.",
    icon: CheckCircle2,
  },
];

const PROMPT_STARTERS = [
  {
    title: "SaaS Landing",
    prompt:
      "SaaS landing page with hero, feature grid, pricing toggle, FAQ, and footer.",
  },
  {
    title: "Hero Split",
    prompt:
      "Hero section with split layout, headline, two CTAs, and a compact product preview.",
  },
  {
    title: "Stats Strip",
    prompt:
      "Stats strip with four metrics and compact captions for social proof.",
  },
];

/* ------------------------------------------------------------------ */
/*  Separators                                                         */
/* ------------------------------------------------------------------ */

function HatchedSeparator() {
  return (
    <div className="relative flex flex-col">
      <div className="w-full border-b border-dashed border-border" />
      <div className="h-4 w-full bg-[image:repeating-linear-gradient(45deg,transparent,transparent_4px,var(--color-border)_4px,var(--color-border)_5px)] opacity-20" />
      <div className="w-full border-b border-dashed border-border" />
      {/* Rail junction nodes — 4-pointed stars */}
      <div className="absolute left-[9px] top-1/2 -translate-x-1/2 -translate-y-1/2">
        <svg width="14" height="14" viewBox="0 0 10 10" className="text-foreground/25">
          <path d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z" fill="currentColor" />
        </svg>
      </div>
      <div className="absolute right-[9px] top-1/2 translate-x-1/2 -translate-y-1/2">
        <svg width="14" height="14" viewBox="0 0 10 10" className="text-foreground/25">
          <path d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

function DashedSeparator() {
  return <div className="w-full border-b border-dashed border-border" />;
}

/* ------------------------------------------------------------------ */
/*  Animated heading                                                   */
/* ------------------------------------------------------------------ */

function AnimatedHeading() {
  const line1 = ["Design.", "Generate."];
  const line2 = ["Ship", "Components."];

  return (
    <motion.h1
      className="font-serif text-5xl font-medium leading-[1.08] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl"
      variants={staggerHeading}
      initial="hidden"
      animate="visible"
    >
      <span className="block">
        {line1.map((word, i) => (
          <motion.span
            key={`a-${i}`}
            variants={wordReveal}
            className="mr-[0.22em] inline-block"
          >
            {word}
          </motion.span>
        ))}
      </span>
      <span className="block">
        {line2.map((word, i) => (
          <motion.span
            key={`b-${i}`}
            variants={wordReveal}
            className="mr-[0.22em] inline-block"
          >
            {word}
          </motion.span>
        ))}
      </span>
    </motion.h1>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function LandingHero() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [mounted, setMounted] = useState(false);

  const [registryItems, setRegistryItems] = useState<RegistryItem[]>([]);
  const [published, setPublished] = useState<VibecodeComponent[]>([]);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [vibecodeLoading, setVibecodeLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ---- data fetch ---- */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [reg, vib] = await Promise.allSettled([
        fetch("/registry"),
        fetch("/api/vibecode"),
      ]);

      if (cancelled) return;

      if (reg.status === "fulfilled" && reg.value.ok) {
        try {
          const data = (await reg.value.json()) as RegistryResponse;
          setRegistryItems(data.items ?? staticRegistry.items ?? []);
        } catch {
          // Fetch succeeded but JSON parse failed — use static fallback
          setRegistryItems((staticRegistry.items ?? []) as RegistryItem[]);
        }
      } else {
        // Fetch failed entirely — use static fallback so categories always render
        setRegistryItems((staticRegistry.items ?? []) as RegistryItem[]);
      }
      setRegistryLoading(false);

      if (vib.status === "fulfilled" && vib.value.ok) {
        try {
          const data = (await vib.value.json()) as unknown;
          setPublished(
            Array.isArray(data) ? (data as VibecodeComponent[]) : [],
          );
        } catch {
          setPublished([]);
        }
      } else {
        setPublished([]);
      }
      setVibecodeLoading(false);
    };

    load().catch(() => {
      if (!cancelled) {
        // Use static fallback so registry categories always render
        setRegistryItems((staticRegistry.items ?? []) as RegistryItem[]);
        setPublished([]);
        setRegistryLoading(false);
        setVibecodeLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- derived ---- */
  const categories = useMemo(() => {
    const counts = new Map<string, { count: number; slug: string }>();
    registryItems.forEach((item) => {
      const raw = item.category?.trim() || "other";
      const key = normalizeCategoryName(raw);
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
        return;
      }
      counts.set(key, { count: 1, slug: raw.toLowerCase() });
    });
    return Array.from(counts.entries())
      .map(([key, val]) => {
        const config = CATEGORY_LOOKUP.get(key);
        return {
          key,
          label: config?.name ?? toTitleCase(key),
          slug: val.slug,
          count: val.count,
          description:
            config?.description ?? `Collection of ${toTitleCase(key)} blocks.`,
          icon: config?.icon ?? null,
        };
      })
      .sort((a, b) =>
        b.count !== a.count
          ? b.count - a.count
          : a.label.localeCompare(b.label),
      );
  }, [registryItems]);

  const featuredCategories = categories.slice(0, 6);
  const featuredVibecode = published.slice(0, 6);

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div>
      {/* ============================================================ */}
      {/*  HERO                                                        */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden">
        {/* GrainGradient shader bg */}
        {mounted && (
          <div className="pointer-events-none absolute inset-0 opacity-[50%]">
            <GrainGradient
              width="100%"
              height="100%"
              colors={
                isDark
                  ? ["#1a1a4a", "#c8c0e8", "#3a3080"]
                  : ["#c8c0e8", "#1a1a4a", "#d8d0f0"]
              }
              colorBack={isDark ? "#0a0a0a" : "#ffffff"}
              softness={0.7}
              intensity={0.15}
              noise={0.5}
              shape="wave"
              speed={1}
            />
          </div>
        )}

        <div className="relative px-6 pb-20 pt-20 sm:pb-28 sm:pt-28 lg:px-12 lg:pb-32 lg:pt-36">
          {/* Badge */}
          <motion.div
            className="mb-8 flex justify-center"
            variants={fadeUp(0.1)}
            initial="hidden"
            animate="visible"
          >
            <div className="relative">
              <motion.div
                className="absolute -inset-1.5 rounded-full border border-foreground/10"
                animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0, 0.2] }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <div className="relative flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground backdrop-blur-sm">
                <Star className="h-3 w-3" />
                Open Source
              </div>
            </div>
          </motion.div>

          {/* Heading */}
          <div className="text-center">
            <AnimatedHeading />
          </div>

          {/* Sub */}
          <motion.p
            className="mx-auto mt-7 max-w-2xl text-center text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl"
            variants={fadeUp(1.0)}
            initial="hidden"
            animate="visible"
          >
            Your unified workspace for a curated component library,
            AI&#8209;powered generation, and vibecoded community
            drops&nbsp;&mdash;&nbsp;all open&nbsp;source.
          </motion.p>

          {/* CTA */}
          <motion.div
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
            variants={fadeUp(1.2)}
            initial="hidden"
            animate="visible"
          >
            <Button size="lg" className="rounded-full px-8" asChild>
              <Link href="/component-generator">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full px-8"
              asChild
            >
              <Link
                href="https://github.com/moazamtech/shadway"
                target="_blank"
                rel="noreferrer"
              >
                <Github className="mr-2 h-4 w-4" />
                Star on GitHub
              </Link>
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
            variants={fadeUp(1.4)}
            initial="hidden"
            animate="visible"
          >
            {[
              {
                label: "registry blocks",
                value: registryLoading
                  ? "\u2014"
                  : String(registryItems.length),
              },
              {
                label: "categories",
                value: registryLoading ? "\u2014" : String(categories.length),
              },
              {
                label: "vibecoded",
                value: vibecodeLoading ? "\u2014" : String(published.length),
              },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-foreground/30" />
                <span className="font-mono text-xs text-muted-foreground">
                  {s.value} {s.label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <HatchedSeparator />

      {/* ============================================================ */}
      {/*  PLATFORM FEATURES                                           */}
      {/* ============================================================ */}
      <section className="px-6 py-16 sm:py-20 lg:px-12">
        <div className="mb-10 flex items-center gap-4">
          <h2 className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Platform
          </h2>
          <div className="h-px flex-1 bg-border/60" />
        </div>

        <motion.div
          className="grid gap-5 md:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          {(
            [
              {
                icon: BookOpen,
                title: "Component Library",
                description:
                  "Browse curated registry blocks across multiple categories. Ready to install with a single command.",
                metric: registryLoading
                  ? "\u2014"
                  : `${registryItems.length} blocks`,
                href: "/docs",
                cta: "Browse Library",
              },
              {
                icon: WandSparkles,
                title: "AI Generator",
                description:
                  "Describe your UI in plain English. Get production-ready components with live preview instantly.",
                metric: "Prompt \u2192 Ship",
                href: "/component-generator",
                cta: "Open Generator",
              },
              {
                icon: Boxes,
                title: "Vibecode Gallery",
                description:
                  "Discover community-built components. Fork, customize, and ship to production in minutes.",
                metric: vibecodeLoading
                  ? "\u2014"
                  : `${published.length} published`,
                href: "/vibecode",
                cta: "Explore Gallery",
              },
            ] as const
          ).map((f) => (
            <motion.div key={f.title} variants={staggerItem}>
              <Link
                href={f.href}
                className="group flex h-full flex-col rounded-xl border border-border/60 bg-card p-6 transition-all duration-300 hover:border-primary/40 hover:shadow-sm"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background transition-colors group-hover:border-primary/30">
                  <f.icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
                </div>
                <h3 className="font-serif text-lg font-medium">{f.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {f.metric}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                    {f.cta}
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <DashedSeparator />

      {/* ============================================================ */}
      {/*  REGISTRY CATEGORIES                                         */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden">
        {/* Dithering shader background */}
        {mounted && (
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <Dithering
              width="100%"
              height="100%"
              colorBack="#00000000"
              colorFront={isDark ? "#4040aa" : "#8888cc"}
              shape="swirl"
              type="8x8"
              size={2}
              speed={0.25}
            />
          </div>
        )}

        <div className="relative px-6 py-16 sm:py-20 lg:px-12">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Component Library
              </p>
              <h2 className="mt-2 font-serif text-2xl tracking-tight md:text-3xl">
                Active registry categories
                <span className="text-primary">.</span>
              </h2>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                Browse curated blocks across {categories.length || "multiple"} categories. Install with a single command.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/docs">
                Open docs
                <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <motion.div
            className="grid gap-px border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-3"
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
          >
            {registryLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`rs-${i}`}
                  className="bg-card p-6"
                >
                  <div className="mb-3 h-8 w-8 animate-pulse rounded-lg bg-muted" />
                  <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                  <div className="mt-3 h-3 w-full animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted" />
                </div>
              ))
            ) : featuredCategories.length > 0 ? (
              featuredCategories.map((cat) => {
                const CatIcon = cat.icon;
                return (
                  <motion.div key={cat.key} variants={staggerItem}>
                    <Link
                      href={`/docs/${encodeURIComponent(cat.slug)}`}
                      className="group flex h-full flex-col bg-card p-6 transition-colors hover:bg-accent/50"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex h-9 w-9 items-center justify-center border border-border bg-background transition-colors group-hover:border-primary/30">
                          {CatIcon ? (
                            <CatIcon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                          ) : (
                            <BookOpen className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                          )}
                        </div>
                        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                          {cat.count} {cat.count === 1 ? "block" : "blocks"}
                        </span>
                      </div>
                      <h3 className="font-serif text-base font-semibold">{cat.label}</h3>
                      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                        {cat.description}
                      </p>
                      <div className="mt-4 flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors group-hover:text-foreground">
                        Open category
                        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  </motion.div>
                );
              })
            ) : (
              <div className="bg-card p-6 sm:col-span-2 lg:col-span-3">
                <p className="text-sm font-semibold">
                  No registry categories yet.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add blocks to your registry and this section updates
                  automatically.
                </p>
              </div>
            )}
          </motion.div>

          {/* Total count strip */}
          {!registryLoading && featuredCategories.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="font-mono text-[11px] text-muted-foreground">
                {registryItems.length} total blocks across {categories.length} categories
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
        </div>
      </section>

      <DashedSeparator />

      {/* ============================================================ */}
      {/*  GENERATOR                                                   */}
      {/* ============================================================ */}
      <section className="px-6 py-16 sm:py-20 lg:px-12">
        {/* Section header */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-4">
            <p className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Component Generator
            </p>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <h2 className="mt-3 font-serif text-2xl tracking-tight md:text-3xl lg:text-4xl">
            Prompt to production in one flow
            <span className="text-primary">.</span>
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Describe your UI in plain English, get production-ready code with
            live preview, edit in Monaco, and publish to the community gallery.
          </p>
        </motion.div>

        {/* Pipeline steps — horizontal connected flow */}
        <motion.div
          className="grid gap-px border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-4"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          {GENERATOR_STEPS.map((step, idx) => (
            <motion.div key={step.title} variants={staggerItem}>
              <div className="group relative flex h-full flex-col bg-card p-6">
                {/* Step number + icon */}
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center border border-border bg-background transition-colors group-hover:border-primary/30">
                    <step.icon className="h-4.5 w-4.5 text-muted-foreground transition-colors group-hover:text-foreground" />
                  </div>
                  <span className="font-mono text-[28px] font-bold leading-none text-border/80">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="font-serif text-base font-semibold">{step.title}</h3>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {step.desc}
                </p>
                {/* Connector arrow (hidden on last step) */}
                {idx < GENERATOR_STEPS.length - 1 && (
                  <div className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 lg:block">
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom row: CTA + Prompt starters */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          {/* CTA card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Link
              href="/component-generator"
              className="group flex h-full flex-col justify-between border border-border/60 bg-card p-6 transition-colors hover:bg-accent/50"
            >
              <div>
                <div className="mb-3 flex h-10 w-10 items-center justify-center border border-border bg-background transition-colors group-hover:border-primary/30">
                  <WandSparkles className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
                </div>
                <h3 className="font-serif text-lg font-semibold">
                  Start generating
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Open the AI generator and build your first component in seconds.
                </p>
              </div>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold transition-colors group-hover:text-foreground">
                Open generator
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </motion.div>

          {/* Prompt starters */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <div className="grid h-full gap-px border border-border/60 bg-border/60 sm:grid-cols-3">
              {PROMPT_STARTERS.map((item) => (
                <Link
                  key={item.title}
                  href={`/component-generator?prompt=${encodeURIComponent(item.prompt)}`}
                  className="group flex flex-col bg-card p-5 transition-colors hover:bg-accent/50"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      Starter
                    </span>
                  </div>
                  <p className="font-serif text-sm font-semibold">{item.title}</p>
                  <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">
                    {item.prompt}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition-colors group-hover:text-foreground">
                    Try it
                    <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <HatchedSeparator />

      {/* ============================================================ */}
      {/*  VIBECODE GALLERY                                            */}
      {/* ============================================================ */}
      <section className="px-6 py-16 sm:py-20 lg:px-12">
        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-4">
            <p className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Published Vibecode
            </p>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl tracking-tight md:text-3xl lg:text-4xl">
                Latest community components
                <span className="text-primary">.</span>
              </h2>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                Discover vibecoded components built by the community. Fork, customize, and ship.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/vibecode">
                View gallery
                <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Grid */}
        <motion.div
          className="grid gap-px border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
        >
          {vibecodeLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={`vs-${i}`} className="bg-card">
                <div className="aspect-[16/10] animate-pulse bg-muted" />
                <div className="space-y-2 p-5">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))
          ) : featuredVibecode.length > 0 ? (
            featuredVibecode.map((item) => (
              <motion.div
                key={item._id || item.slug}
                variants={staggerItem}
                className="h-full"
              >
                <Link
                  href={`/vibecode/${item.slug}`}
                  className="group flex h-full flex-col bg-card transition-colors hover:bg-accent/50"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                    <Image
                      src={item.thumbnailUrl || "/placeholder-image.jpg"}
                      alt={item.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    {/* Date overlay */}
                    {formatDate(item.publishedAt) && (
                      <span className="absolute right-3 top-3 border border-border/40 bg-background/80 px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground backdrop-blur-sm">
                        {formatDate(item.publishedAt)}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-1.5 flex items-center gap-2">
                      {item.category && (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <h3 className="line-clamp-1 font-serif text-sm font-semibold">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                    <div className="mt-4 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition-colors group-hover:text-foreground">
                      View component
                      <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))
          ) : (
            <div className="bg-card p-6 sm:col-span-2 lg:col-span-3">
              <p className="text-sm font-semibold">
                No published components yet.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Publish from the generator and they will appear here.
              </p>
            </div>
          )}
        </motion.div>

        {/* Bottom stats */}
        {!vibecodeLoading && featuredVibecode.length > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="font-mono text-[11px] text-muted-foreground">
              {published.length} published components
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}
      </section>

      <HatchedSeparator />

      {/* ============================================================ */}
      {/*  OPEN SOURCE CTA                                             */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden">
        {mounted && (
          <div className="pointer-events-none absolute inset-0 opacity-80">
            <StaticRadialGradient
              width="100%"
              height="100%"
              colors={
                isDark
                  ? ["#1a1a6a", "#2a2080", "#4040aa"]
                  : ["#a0b0ff", "#b8c8ff", "#dce4ff"]
              }
              colorBack={isDark ? "#0a0a0a" : "#ffffff"}
              radius={0.8}
              focalDistance={0.99}
              focalAngle={0}
              falloff={0.24}
              mixing={0.5}
              distortion={0}
              distortionShift={0}
              distortionFreq={12}
              grainMixer={0}
              grainOverlay={0}
            />
          </div>
        )}

        <div className="relative px-6 py-20 text-center sm:py-28 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="mx-auto mb-6 flex items-center justify-center gap-2">
              <Github className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Open Source
              </span>
            </div>

            <h2 className="mx-auto max-w-xl font-serif text-3xl tracking-tight sm:text-4xl md:text-5xl">
              Built by the community,
              <br />
              for the community
              <span className="text-primary">.</span>
            </h2>

            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Shadway is fully open source. Contribute components, report
              issues, or star the repo to support the project.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" className="rounded-full px-8" asChild>
                <Link href="/component-generator">
                  Start Building
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8"
                asChild
              >
                <Link
                  href="https://github.com/moazamtech/shadway"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Github className="mr-2 h-4 w-4" />
                  View on GitHub
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <HatchedSeparator />
      <LandingFooter />
    </div>
  );
}
