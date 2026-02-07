"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  GrainGradient,
  StaticRadialGradient,
  Dithering,
  GodRays,
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

function resolveThumbnailSrc(url: string | undefined) {
  if (!url) return "/placeholder-image.jpg";
  const value = url.trim();
  if (!value) return "/placeholder-image.jpg";
  if (value.startsWith("/")) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return "/placeholder-image.jpg";
}

const CATEGORY_LOOKUP = new Map(
  CATEGORIES_CONFIG.map((c) => [normalizeCategoryName(c.name), c]),
);

const HEATMAP_ICONS = {
  book:
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 7h6"/><path d="M8 11h4"/></svg>',
    ),
  wand:
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>',
    ),
  boxes:
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"/><path d="m7 16.5-4.74-2.85"/><path d="m7 16.5 5-3"/><path d="M7 16.5v5.17"/><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"/><path d="m17 16.5-5-3"/><path d="m17 16.5 4.74-2.85"/><path d="M17 16.5v5.17"/><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"/><path d="M12 8 7.26 5.15"/><path d="m12 8 4.74-2.85"/><path d="M12 13.5V8"/></svg>',
    ),
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
        <svg
          width="14"
          height="14"
          viewBox="0 0 10 10"
          className="text-foreground/25"
        >
          <path
            d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="absolute right-[9px] top-1/2 translate-x-1/2 -translate-y-1/2">
        <svg
          width="14"
          height="14"
          viewBox="0 0 10 10"
          className="text-foreground/25"
        >
          <path
            d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </div>
  );
}

function DashedSeparator() {
  return <div className="w-full border-b border-dashed border-border" />;
}

function OutsideRailMotif({
  className,
  duration = 8,
  delay = 0,
  rotate = 6,
  y = 10,
  children,
}: {
  className: string;
  duration?: number;
  delay?: number;
  rotate?: number;
  y?: number;
  children: ReactNode;
}) {
  return (
    <motion.svg
      aria-hidden="true"
      viewBox="0 0 220 220"
      className={className}
      animate={{
        y: [0, -y, 0],
        rotate: [0, rotate, 0],
        opacity: [0.25, 0.65, 0.25],
      }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.svg>
  );
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
  const heroShaderColors = isDark
    ? ["#2596be", "#0154a5", "#0241a7"]
    : ["#0154a5", "#0154a5", "#0241a7"];
  const heroShaderBack = isDark ? "#0a0a0a" : "#ffffff";
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
      <section className="relative overflow-visible">
        {/* GrainGradient shader bg */}
        {mounted && (
          <div className="pointer-events-none absolute inset-0 opacity-75">
            <GrainGradient
              width="100%"
              height="100%"
              colors={heroShaderColors}
              colorBack={heroShaderBack}
              softness={0.7}
              intensity={0.15}
              noise={0.5}
              shape="wave"
              speed={1}
            />
          </div>
        )}

        {/* Outside-rail animated SVG accents */}
        <motion.svg
          aria-hidden="true"
          viewBox="0 0 220 220"
          className="pointer-events-none absolute -left-24 top-20 hidden h-44 w-44 text-primary/30 lg:block"
          animate={{
            y: [0, -10, 0],
            rotate: [0, 4, 0],
            opacity: [0.35, 0.65, 0.35],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          <circle
            cx="110"
            cy="110"
            r="86"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <circle
            cx="110"
            cy="110"
            r="58"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 8"
          />
          <path
            d="M110 24 L120 92 L188 110 L120 128 L110 196 L100 128 L32 110 L100 92 Z"
            fill="currentColor"
            opacity="0.28"
          />
        </motion.svg>
        <motion.svg
          aria-hidden="true"
          viewBox="0 0 220 220"
          className="pointer-events-none absolute -right-24 top-36 hidden h-40 w-40 text-primary/25 lg:block"
          animate={{
            y: [0, 12, 0],
            rotate: [0, -5, 0],
            opacity: [0.3, 0.55, 0.3],
          }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.6,
          }}
        >
          <rect
            x="35"
            y="35"
            width="150"
            height="150"
            rx="30"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path
            d="M110 46 L174 110 L110 174 L46 110 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="5 10"
          />
          <circle cx="110" cy="110" r="16" fill="currentColor" opacity="0.28" />
        </motion.svg>

        <div className="relative px-6 pb-14 pt-14 sm:pb-16 sm:pt-16 lg:px-12 lg:pb-20 lg:pt-20">
          {/* Badge */}
          <motion.div
            className="mb-8 flex justify-center"
            variants={fadeUp(0.1)}
            initial="hidden"
            animate="visible"
          >
            <div className="relative">
              {/* Soft glow pulse */}
              <motion.div
                className="absolute -inset-3 rounded-full bg-primary/15 blur-xl"
                animate={{
                  opacity: [0.2, 0.5, 0.2],
                  scale: [0.95, 1.05, 0.95],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              {/* Animated gradient border */}
              <motion.div
                className="absolute -inset-[1px] rounded-full bg-gradient-to-r from-primary/60 via-primary/20 to-primary/60"
                animate={{ backgroundPosition: ["0% 50%", "200% 50%"] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                style={{ backgroundSize: "200% 100%" }}
              />
              <div className="relative flex items-center gap-2.5 rounded-full border border-primary/10 bg-background/95 px-5 py-2 backdrop-blur-xl">
                {/* Shimmer sweep */}
                <span className="absolute inset-0 overflow-hidden rounded-full">
                  <motion.span
                    className="absolute inset-y-0 w-[30%] bg-gradient-to-r from-transparent via-primary/10 to-transparent"
                    animate={{ left: ["-30%", "130%"] }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                      repeatDelay: 1.5,
                    }}
                  />
                </span>
                <motion.span
                  animate={{ rotate: [0, 360] }}
                  transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <Star className="h-3 w-3 text-primary" />
                </motion.span>
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-foreground/75">
                  Open Source
                </span>
              </div>
            </div>
          </motion.div>

          {/* Heading */}
          <div className="text-center">
            <AnimatedHeading />
          </div>

          {/* Sub */}
          <motion.p
            className="mx-auto mt-5 max-w-2xl text-center text-base leading-relaxed text-foreground/65 sm:text-lg md:text-xl"
            variants={fadeUp(1.0)}
            initial="hidden"
            animate="visible"
          >
            Your unified workspace for a curated component library,
            AI&#8209;powered generation, and vibecoded community
            drops&nbsp;&mdash;&nbsp;all open&nbsp;source.
          </motion.p>

          <div
            id="hero-sticky-trigger"
            className="mt-4 h-px w-full"
            aria-hidden="true"
          />

          {/* CTA */}
          <motion.div
            className="mt-6 flex flex-wrap items-center justify-center gap-3"
            variants={fadeUp(1.2)}
            initial="hidden"
            animate="visible"
          >
            {/* Get Started — primary CTA */}
            <Link
              href="/component-generator"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-primary px-7 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/35"
            >
              <span className="absolute inset-0 overflow-hidden rounded-full">
                <motion.span
                  className="absolute inset-y-0 w-[35%] bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{ left: ["-35%", "135%"] }}
                  transition={{
                    duration: 2.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                    repeatDelay: 2,
                  }}
                />
              </span>
              <span className="relative tracking-wide">Get Started</span>
              <ArrowRight className="relative h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>

            {/* Star on GitHub — secondary CTA */}
            <Link
              href="https://github.com/moazamtech/shadway"
              target="_blank"
              rel="noreferrer"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-border/50 bg-background/80 px-7 py-2.5 text-sm font-semibold backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:bg-background/95"
            >
              <span className="absolute inset-0 overflow-hidden rounded-full">
                <motion.span
                  className="absolute inset-y-0 w-[35%] bg-gradient-to-r from-transparent via-primary/[0.07] to-transparent"
                  animate={{ left: ["-35%", "135%"] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    repeatDelay: 2.5,
                    delay: 1,
                  }}
                />
              </span>
              <Github className="relative h-3.5 w-3.5" />
              <span className="relative tracking-wide">Star on GitHub</span>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
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
                <div className="h-1.5 w-1.5 rounded-full bg-primary/50" />
                <span className="font-mono text-xs text-foreground/55">
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

      <HatchedSeparator />

      {/* ============================================================ */}
      {/*  REGISTRY CATEGORIES                                         */}
      {/* ============================================================ */}
      <section className="relative overflow-visible">
        {mounted && (
          <div className="pointer-events-none absolute inset-0 z-0 opacity-30">
            <Dithering
              width="100%"
              height="100%"
              colorBack="#00000000"
              colorFront={heroShaderColors[2]}
              shape="warp"
              type="4x4"
              size={2.75}
              speed={1}
            />
          </div>
        )}

        <OutsideRailMotif
          className="pointer-events-none absolute -left-24 top-20 hidden h-40 w-40 text-primary/25 lg:block"
          duration={9}
          rotate={-7}
          y={12}
        >
          <path
            d="M35 110 Q110 30 185 110 Q110 190 35 110Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <circle cx="110" cy="110" r="22" fill="currentColor" opacity="0.28" />
          <path
            d="M110 44 L126 94 L176 110 L126 126 L110 176 L94 126 L44 110 L94 94 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="5 7"
          />
        </OutsideRailMotif>
        <OutsideRailMotif
          className="pointer-events-none absolute -right-24 bottom-12 hidden h-44 w-44 text-primary/20 lg:block"
          duration={10}
          delay={0.3}
          rotate={5}
          y={9}
        >
          <rect
            x="42"
            y="42"
            width="136"
            height="136"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path
            d="M42 42 L178 178 M178 42 L42 178"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.5"
          />
          <circle cx="110" cy="110" r="10" fill="currentColor" opacity="0.3" />
        </OutsideRailMotif>

        <div className="relative z-10 px-6 py-16 sm:py-20 lg:px-12">
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
                Browse curated blocks across {categories.length || "multiple"}{" "}
                categories. Install with a single command.
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
            initial="show"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
          >
            {registryLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={`rs-${i}`} className="bg-card p-6">
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
                      <h3 className="font-serif text-base font-semibold">
                        {cat.label}
                      </h3>
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
                {registryItems.length} total blocks across {categories.length}{" "}
                categories
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
        </div>
      </section>

      <HatchedSeparator />

      {/* ============================================================ */}
      {/*  GENERATOR                                                   */}
      {/* ============================================================ */}
      <section className="relative overflow-visible px-6 py-16 sm:py-20 lg:px-12">
        <OutsideRailMotif
          className="pointer-events-none absolute -left-28 top-28 hidden h-48 w-48 text-primary/20 lg:block"
          duration={11}
          delay={0.2}
          rotate={4}
          y={14}
        >
          <circle
            cx="110"
            cy="110"
            r="82"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeDasharray="3 8"
          />
          <path
            d="M110 30 L158 110 L110 190 L62 110 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
          />
          <path
            d="M72 86 H148 M72 134 H148"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.55"
          />
        </OutsideRailMotif>
        <OutsideRailMotif
          className="pointer-events-none absolute -right-28 bottom-8 hidden h-40 w-40 text-primary/25 lg:block"
          duration={8.5}
          delay={0.5}
          rotate={-6}
          y={10}
        >
          <path
            d="M110 28 L192 110 L110 192 L28 110 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <circle
            cx="110"
            cy="110"
            r="34"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
          <circle cx="110" cy="110" r="12" fill="currentColor" opacity="0.3" />
        </OutsideRailMotif>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-6 backdrop-blur-sm md:p-8">
            {mounted && (
              <div className="pointer-events-none absolute inset-0 opacity-70">
                <GodRays
                  width="100%"
                  height="100%"
                  colors={heroShaderColors}
                  colorBack={heroShaderBack}
                  colorBloom="#00000000"
                  bloom={0.6}
                  intensity={0.6}
                  density={0.03}
                  spotty={0.77}
                  midSize={0.1}
                  midIntensity={0.6}
                  speed={1}
                  offsetX={-0.6}
                />
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-background/20 via-background/55 to-background/75" />
            <div className="relative">
              <div className="mb-3 flex items-center gap-4">
                <p className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.22em] text-primary">
                  Component Generator
                </p>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <h2 className="font-serif text-2xl tracking-tight md:text-4xl">
                Build interfaces like a futuristic workflow
                <span className="text-primary">.</span>
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Prompt, preview, and publish in one sleek pipeline. A clean
                generation surface designed to move from idea to deployable UI
                in minutes.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button size="sm" className="rounded-full px-5" asChild>
                  <Link href="/component-generator">
                    Open Generator
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GENERATOR_STEPS.map((step, idx) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.35, delay: idx * 0.05 }}
              className="h-full"
            >
              <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/85 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_12px_35px_-22px_rgba(0,0,0,0.7)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background/80 transition-colors group-hover:border-primary/30">
                    <step.icon className="h-4.5 w-4.5 text-muted-foreground transition-colors group-hover:text-foreground" />
                  </div>
                  <span className="font-mono text-2xl font-bold leading-none text-border/80">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="font-serif text-base font-semibold">
                  {step.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {PROMPT_STARTERS.map((item, idx) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.35, delay: idx * 0.04 }}
            >
              <Link
                href={`/component-generator?prompt=${encodeURIComponent(item.prompt)}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/85 p-5 transition-all duration-300 hover:border-primary/35 hover:bg-accent/40"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Prompt Starter
                  </span>
                </div>
                <p className="font-serif text-sm font-semibold">{item.title}</p>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                  {item.prompt}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors group-hover:text-foreground">
                  Use Prompt
                  <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <HatchedSeparator />

      {/* ============================================================ */}
      {/*  VIBECODE GALLERY                                            */}
      {/* ============================================================ */}
      <section className="relative overflow-visible px-6 py-16 sm:py-20 lg:px-12">
        <OutsideRailMotif
          className="pointer-events-none absolute -left-24 top-20 hidden h-44 w-44 text-primary/20 lg:block"
          duration={9.5}
          delay={0.15}
          rotate={7}
          y={8}
        >
          <rect
            x="36"
            y="36"
            width="148"
            height="148"
            rx="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path
            d="M110 52 V168 M52 110 H168"
            stroke="currentColor"
            strokeWidth="1"
          />
          <circle cx="110" cy="110" r="14" fill="currentColor" opacity="0.25" />
        </OutsideRailMotif>
        <OutsideRailMotif
          className="pointer-events-none absolute -right-24 bottom-16 hidden h-40 w-40 text-primary/25 lg:block"
          duration={12}
          delay={0.4}
          rotate={-4}
          y={13}
        >
          <path
            d="M110 24 L150 70 L196 110 L150 150 L110 196 L70 150 L24 110 L70 70 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
          />
          <path
            d="M66 66 L154 154 M154 66 L66 154"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.5"
          />
        </OutsideRailMotif>
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
                Discover vibecoded components built by the community. Fork,
                customize, and ship.
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vibecodeLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`vs-${i}`}
                className="overflow-hidden rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm"
              >
                <div className="aspect-[2/1] animate-pulse bg-muted/50" />
                <div className="space-y-2 p-3">
                  <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted/60" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted/50" />
                </div>
              </div>
            ))
          ) : featuredVibecode.length > 0 ? (
            featuredVibecode.map((item, index) => (
              <motion.div
                key={item._id || item.slug}
                className="h-full"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.35, delay: index * 0.04 }}
              >
                <Link
                  href={`/vibecode/${item.slug}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm transition-colors duration-300 hover:border-primary/30 hover:bg-card/80"
                >
                  {/* Top accent line */}
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                  {/* Thumbnail */}
                  <div className="relative aspect-[2/1] w-full overflow-hidden bg-muted/40">
                    <Image
                      src={resolveThumbnailSrc(item.thumbnailUrl)}
                      alt={item.title}
                      fill
                      className="object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
                    {/* Overlays */}
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 pb-2.5">
                      {item.category && (
                        <span className="rounded border border-primary/20 bg-background/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary backdrop-blur-sm">
                          {item.category}
                        </span>
                      )}
                      {formatDate(item.publishedAt) && (
                        <span className="font-mono text-[9px] tabular-nums text-foreground/50">
                          {formatDate(item.publishedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="line-clamp-1 text-sm font-semibold tracking-tight">
                        {item.title}
                      </h3>
                      <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))
          ) : (
            <div className="rounded-2xl border border-border/60 bg-card p-6 sm:col-span-2 lg:col-span-3">
              <p className="text-sm font-semibold">
                No published components yet.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Publish from the generator and they will appear here.
              </p>
            </div>
          )}
        </div>

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
      <section className="relative overflow-visible">
        {mounted && (
          <div className="pointer-events-none absolute inset-0 opacity-80">
            <StaticRadialGradient
              width="100%"
              height="100%"
              colors={heroShaderColors}
              colorBack={heroShaderBack}
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

        <OutsideRailMotif
          className="pointer-events-none absolute -left-28 top-10 hidden h-52 w-52 text-primary/20 lg:block"
          duration={13}
          delay={0.25}
          rotate={5}
          y={15}
        >
          <circle
            cx="110"
            cy="110"
            r="90"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
          />
          <circle
            cx="110"
            cy="110"
            r="62"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="6 10"
          />
          <path
            d="M110 20 L122 96 L200 110 L122 124 L110 200 L98 124 L20 110 L98 96 Z"
            fill="currentColor"
            opacity="0.18"
          />
        </OutsideRailMotif>
        <OutsideRailMotif
          className="pointer-events-none absolute -right-28 bottom-10 hidden h-44 w-44 text-primary/25 lg:block"
          duration={10.5}
          delay={0.55}
          rotate={-8}
          y={9}
        >
          <rect
            x="32"
            y="32"
            width="156"
            height="156"
            rx="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
          />
          <path
            d="M64 64 H156 V156 H64 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
          <circle cx="110" cy="110" r="11" fill="currentColor" opacity="0.28" />
        </OutsideRailMotif>

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
