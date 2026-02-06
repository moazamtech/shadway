"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { Dithering, GodRays } from "@paper-design/shaders-react";
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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
      {/* Rail junction nodes */}
      <div className="absolute left-[9px] top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-2.5 w-2.5 rounded-full border-2 border-border bg-background" />
      </div>
      <div className="absolute right-[9px] top-1/2 translate-x-1/2 -translate-y-1/2">
        <div className="h-2.5 w-2.5 rounded-full border-2 border-border bg-background" />
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
          setRegistryItems(data.items ?? []);
        } catch {
          setRegistryItems([]);
        }
      } else {
        setRegistryItems([]);
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
        setRegistryItems([]);
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
        {/* Dithering shader bg */}
        {mounted && (
          <div className="pointer-events-none absolute inset-0 opacity-[0.25]">
            <Dithering
              width="100%"
              height="100%"
              colorBack={isDark ? "#0a0a0a" : "#ffffff"}
              colorFront={isDark ? "#18183a" : "#d4d4e8"}
              shape="sphere"
              type="4x4"
              size={3}
              speed={0.25}
              scale={0.7}
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
                value: registryLoading
                  ? "\u2014"
                  : String(categories.length),
              },
              {
                label: "vibecoded",
                value: vibecodeLoading
                  ? "\u2014"
                  : String(published.length),
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
      <section className="px-6 py-16 sm:py-20 lg:px-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Component Library
            </p>
            <h2 className="mt-2 font-serif text-2xl tracking-tight md:text-3xl">
              Active registry categories
              <span className="text-primary">.</span>
            </h2>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/docs">Open docs</Link>
          </Button>
        </div>

        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
        >
          {registryLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`rs-${i}`}
                  className="rounded-xl border border-border bg-card p-5"
                >
                  <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                  <div className="mt-3 h-3 w-full animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted" />
                </div>
              ))
            : featuredCategories.length > 0
              ? featuredCategories.map((cat) => (
                  <motion.div key={cat.key} variants={staggerItem}>
                    <Link
                      href={`/docs/${encodeURIComponent(cat.slug)}`}
                      className="group flex flex-col rounded-xl border border-border/60 bg-card p-5 transition-all hover:border-primary/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-semibold">
                          {cat.label}
                        </h3>
                        <Badge
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {cat.count}
                        </Badge>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {cat.description}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors group-hover:text-foreground">
                        Open category
                        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  </motion.div>
                ))
              : (
                  <div className="rounded-xl border border-dashed border-border bg-card p-5 sm:col-span-2 lg:col-span-3">
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
      </section>

      <DashedSeparator />

      {/* ============================================================ */}
      {/*  GENERATOR                                                   */}
      {/* ============================================================ */}
      <section className="px-6 py-16 sm:py-20 lg:px-12">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Component Generator
            </p>
            <h2 className="mt-2 font-serif text-2xl tracking-tight md:text-3xl">
              Prompt to production in one flow
              <span className="text-primary">.</span>
            </h2>
            <p className="mt-3 max-w-lg text-sm text-muted-foreground">
              Describe your UI, get production-ready code with live preview,
              edit in Monaco, and publish to the community gallery.
            </p>

            <ol className="mt-6 space-y-3">
              {GENERATOR_STEPS.map((step, idx) => (
                <motion.li
                  key={step.title}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-3"
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.08, duration: 0.35 }}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                    <step.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {idx + 1}. {step.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {step.desc}
                    </p>
                  </div>
                </motion.li>
              ))}
            </ol>

            <Button className="mt-6 rounded-full" asChild>
              <Link href="/component-generator">
                Open generator
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Prompt Starters
              </p>
              <h3 className="mt-2 font-serif text-lg">
                Ready to run in the generator.
              </h3>
              <div className="mt-4 space-y-3">
                {PROMPT_STARTERS.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-lg border border-border/50 bg-background p-3"
                  >
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {item.prompt}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <DashedSeparator />

      {/* ============================================================ */}
      {/*  VIBECODE GALLERY                                            */}
      {/* ============================================================ */}
      <section className="px-6 py-16 sm:py-20 lg:px-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Published Vibecode
            </p>
            <h2 className="mt-2 font-serif text-2xl tracking-tight md:text-3xl">
              Latest community components
              <span className="text-primary">.</span>
            </h2>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/vibecode">View gallery</Link>
          </Button>
        </div>

        <motion.div
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
        >
          {vibecodeLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`vs-${i}`}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  <div className="aspect-[16/10] animate-pulse bg-muted" />
                  <div className="space-y-2 p-4">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-full animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))
            : featuredVibecode.length > 0
              ? featuredVibecode.map((item) => (
                  <motion.div
                    key={item._id || item.slug}
                    variants={staggerItem}
                  >
                    <Link
                      href={`/vibecode/${item.slug}`}
                      className="group block overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-primary/40"
                    >
                      <div className="relative aspect-[16/10] w-full bg-muted">
                        <Image
                          src={item.thumbnailUrl || "/placeholder-image.jpg"}
                          alt={item.title}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      </div>
                      <div className="space-y-2 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="line-clamp-1 text-sm font-semibold">
                            {item.title}
                          </p>
                          {item.category && (
                            <Badge variant="outline" className="text-[10px]">
                              {item.category}
                            </Badge>
                          )}
                        </div>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {item.description}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors group-hover:text-foreground">
                            Open component
                            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                          </span>
                          {formatDate(item.publishedAt) && (
                            <span className="text-[11px] text-muted-foreground">
                              {formatDate(item.publishedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))
              : (
                  <div className="rounded-xl border border-dashed border-border bg-card p-5 sm:col-span-2 lg:col-span-3">
                    <p className="text-sm font-semibold">
                      No published components yet.
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Publish from the generator and they will appear here.
                    </p>
                  </div>
                )}
        </motion.div>
      </section>

      <HatchedSeparator />

      {/* ============================================================ */}
      {/*  OPEN SOURCE CTA                                             */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden">
        {mounted && (
          <div className="pointer-events-none absolute inset-0 opacity-20">
            <GodRays
              width="100%"
              height="100%"
              colors={
                isDark
                  ? ["#20206080", "#10104a80", "#18183a80"]
                  : ["#a0a0ff50", "#b0b0ff50", "#c0c0ff50"]
              }
              colorBack={isDark ? "#0a0a0a" : "#ffffff"}
              colorBloom={isDark ? "#5050ff" : "#8080ff"}
              bloom={0.4}
              intensity={0.4}
              density={0.04}
              spotty={0.5}
              midSize={0.15}
              midIntensity={0.4}
              speed={0.25}
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

      {/* ============================================================ */}
      {/*  SHADWAY TEXT EFFECT                                         */}
      {/* ============================================================ */}
      <div className="mx-auto max-w-[1300px] overflow-x-hidden">
        <TextHoverEffect text="SHADWAY" />
      </div>
    </div>
  );
}
