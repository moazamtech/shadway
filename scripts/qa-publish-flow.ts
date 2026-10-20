import "dotenv/config";
import { count, eq, type SQL } from "drizzle-orm";

import { db } from "../lib/db/postgres";
import { components as componentsTable } from "../lib/db/schema";
import { BASE, createQaAccount, removeQaAccount } from "./qa-session";

/**
 * The publish pipeline, end to end, over components that look like real ones.
 *
 * Publishing is not a form submission. The studio compiles the component with
 * the same esbuild + Tailwind build the marketplace serves, renders it once in
 * headless Chrome for the cover, and only then writes the row. This script walks
 * that exact two-request sequence — `/api/studio/build-preview` then
 * `/api/components` — for a spread of component shapes, then reads back every
 * surface a buyer touches:
 *
 *   - the published document (`/api/components/preview`) renders the component
 *   - its `ETag` is a 304 on the second request, so a warm view is free
 *   - the registry item (`/r/<slug>`) is complete JSON
 *   - the detail page (`/c/<slug>`) serves it
 *   - a component that does not compile is refused with the compiler's own
 *     message, and nothing is stored
 *
 * Timings are printed per fixture and totalled. The budgets are deliberately
 * loose — this is a regression tripwire, not a benchmark; a machine under load
 * should not turn a correct build red.
 *
 * Run with a dev server up:
 *   npx tsx scripts/qa-publish-flow.ts
 */

/** A build is a bundler pass plus a headless render. */
const BUILD_BUDGET_MS = 90_000;
/** A cold first view builds and stores; a warm one is an ETag check. */
const FIRST_VIEW_BUDGET_MS = 30_000;

type CookieJar = Record<string, string>;
const jar: CookieJar = {};

function cookieHeader() {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function collectCookies(res: Response) {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw: string[] =
    typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const cookie of raw) {
    const first = cookie.split(";")[0];
    const idx = first.indexOf("=");
    if (idx <= 0) continue;
    jar[first.slice(0, idx).trim()] = first.slice(idx + 1).trim();
  }
}

async function request(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("cookie", cookieHeader());
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    redirect: "manual",
  });
  collectCookies(res);
  return res;
}

async function login(email: string, password: string) {
  const csrfRes = await request("/api/auth/csrf");
  const csrf = await csrfRes.json();

  const params = new URLSearchParams();
  params.set("csrfToken", csrf.csrfToken);
  params.set("email", email);
  params.set("password", password);
  params.set("callbackUrl", `${BASE}/`);
  params.set("json", "true");

  await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
}

let failures = 0;
function log(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  ${extra}` : ""}`);
  if (!ok) failures += 1;
}

const ms = (start: number) => Math.round(performance.now() - start);

type Fixture = {
  /** A token that has to survive into the published document. */
  marker: string;
  title: string;
  description: string;
  category: "ui" | "marketing";
  dependencies: string[];
  code: string;
  files?: { path: string; content: string }[];
  /**
   * A package the app does not have installed. The build is expected to hand it
   * to the document's import map rather than fail — which is how a component can
   * use something the server has never seen.
   */
  cdnDependency?: string;
};

/**
 * Six components, chosen because they fail in different places.
 *
 * A build that only ever sees a `div` proves the bundler runs. These cover the
 * things that have actually broken here: a client-only animation library, a
 * Radix primitive that needs its vendored `components/ui` file, an icon set with
 * hundreds of named exports, the `next/*` shims, a project with more than one
 * file, and a dependency that only exists on a CDN.
 */
const FIXTURES: Fixture[] = [
  {
    marker: "QA-MOTION-A1",
    title: "QA Motion Banner",
    description: "A spring-animated banner built on motion.",
    category: "ui",
    dependencies: ["motion"],
    code: `import { motion } from "motion/react";

export default function MotionBanner() {
  return (
    <div className="flex min-h-[240px] w-full items-center justify-center bg-background p-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.04 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        className="rounded-xl border border-border bg-card px-6 py-4 shadow-sm"
      >
        <p className="text-sm font-medium">QA-MOTION-A1</p>
        <p className="text-xs text-muted-foreground">Spring-animated banner</p>
      </motion.div>
    </div>
  );
}
`,
  },
  {
    marker: "QA-DIALOG-B2",
    title: "QA Confirm Dialog",
    description: "A destructive confirmation inside a Radix dialog.",
    category: "ui",
    dependencies: ["@radix-ui/react-dialog", "lucide-react"],
    code: `import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function ConfirmDialog() {
  return (
    <div className="flex min-h-[240px] w-full items-center justify-center bg-background p-10">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">QA-DIALOG-B2</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this project?</DialogTitle>
            <DialogDescription>
              The component and its history are removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
`,
  },
  {
    marker: "QA-ICONS-C3",
    title: "QA Icon Wall",
    description: "A grid of lucide icons rendered through a map.",
    category: "ui",
    dependencies: ["lucide-react"],
    code: `import {
  Activity,
  ArrowRight,
  Bell,
  Bookmark,
  Check,
  Code2,
  Command,
  Download,
  Layers,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";

const ICONS = [
  Activity, ArrowRight, Bell, Bookmark, Check, Code2,
  Command, Download, Layers, Sparkles, Star, Zap,
];

export default function IconWall() {
  return (
    <div className="flex min-h-[240px] w-full items-center justify-center bg-background p-10">
      <div className="grid grid-cols-6 gap-3">
        {ICONS.map((Icon, index) => (
          <span
            key={index}
            className="flex size-10 items-center justify-center rounded-lg border border-border bg-card"
          >
            <Icon className="size-4" />
          </span>
        ))}
      </div>
      <p className="sr-only">QA-ICONS-C3</p>
    </div>
  );
}
`,
  },
  {
    marker: "QA-ASSET-D4",
    title: "QA Asset Card",
    description: "next/image and next/link inside a card.",
    category: "ui",
    dependencies: ["lucide-react"],
    code: `import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export default function AssetCard() {
  return (
    <div className="flex min-h-[240px] w-full items-center justify-center bg-background p-10">
      <article className="w-[320px] overflow-hidden rounded-xl border border-border bg-card">
        <Image
          src="/placeholder-image.jpg"
          alt=""
          width={320}
          height={180}
          className="h-[180px] w-full object-cover"
        />
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium">QA-ASSET-D4</p>
            <p className="text-xs text-muted-foreground">A media card</p>
          </div>
          <Link
            href="https://example.com"
            className="inline-flex items-center gap-1 text-xs font-medium"
          >
            Open <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </article>
    </div>
  );
}
`,
  },
  {
    marker: "QA-MULTI-E5",
    title: "QA Multi File Stat",
    description: "A component that imports its own helper module.",
    category: "ui",
    dependencies: [],
    code: `import { formatCount, type Stat } from "./stat";

const stats: Stat[] = [
  { label: "Installs", value: 12840 },
  { label: "Stars", value: 932 },
  { label: "Forks", value: 41 },
];

export default function MultiFileStat() {
  return (
    <div className="flex min-h-[240px] w-full items-center justify-center bg-background p-10">
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-lg font-semibold tabular-nums">{formatCount(stat.value)}</p>
            <p className="text-[11px] text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
      <p className="sr-only">QA-MULTI-E5</p>
    </div>
  );
}
`,
    files: [
      {
        path: "/components/stat.tsx",
        content: `export type Stat = { label: string; value: number };

export function formatCount(value: number): string {
  if (value >= 1000) return (value / 1000).toFixed(1) + "k";
  return String(value);
}
`,
      },
    ],
  },
  {
    marker: "QA-CDN-F6",
    title: "QA Framework Row",
    description: "Icons from a package the server does not have installed.",
    category: "ui",
    dependencies: ["react-icons"],
    cdnDependency: "react-icons",
    code: `import { SiNextdotjs, SiReact, SiTailwindcss } from "react-icons/si";

const FRAMEWORKS = [
  { name: "React", Icon: SiReact },
  { name: "Next.js", Icon: SiNextdotjs },
  { name: "Tailwind", Icon: SiTailwindcss },
];

export default function FrameworkRow() {
  return (
    <div className="flex min-h-[240px] w-full items-center justify-center bg-background p-10">
      <div className="flex items-center gap-4">
        {FRAMEWORKS.map(({ name, Icon }) => (
          <div key={name} className="flex flex-col items-center gap-2">
            <Icon className="size-7" />
            <span className="text-xs">{name}</span>
          </div>
        ))}
      </div>
      <p className="sr-only">QA-CDN-F6</p>
    </div>
  );
}
`,
  },
  {
    marker: "QA-MOTION-HERO",
    title: "QA Motion Hero",
    description: "A hero section with staggered motion and a gradient headline.",
    category: "marketing",
    dependencies: ["motion", "lucide-react"],
    code: `"use client";

import { motion } from "motion/react";
import { ArrowRight, Sparkles, Star } from "lucide-react";

const AVATARS = ["AL", "MK", "JP", "RS"];

export default function MotionHero() {
  return (
    <section className="relative isolate overflow-hidden bg-background px-6 py-24">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-10%,rgba(99,102,241,0.28),transparent_62%)]" />
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.2, 0, 0, 1] }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur"
        >
          <Sparkles className="size-3" aria-hidden="true" />
          New — the component exchange
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.2, 0, 0, 1] }}
          className="mt-6 text-balance text-5xl font-semibold tracking-[-0.03em] sm:text-6xl"
        >
          Ship interfaces{" "}
          <span className="bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
            at the speed of thought
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.16, ease: [0.2, 0, 0, 1] }}
          className="mt-5 max-w-lg text-pretty text-sm leading-relaxed text-muted-foreground"
        >
          A marketplace of production components, published from a real sandbox
          and installed with one command.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.24, ease: [0.2, 0, 0, 1] }}
          className="mt-8 flex flex-wrap items-center justify-center gap-2.5"
        >
          <a
            href="#"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-xs font-medium text-background transition-transform duration-200 hover:-translate-y-px"
          >
            Browse components
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </a>
          <a
            href="#"
            className="inline-flex h-9 items-center rounded-md border border-border px-4 text-xs font-medium transition-colors hover:bg-muted"
          >
            Publish yours
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-10 flex items-center gap-3"
        >
          <div className="flex -space-x-2">
            {AVATARS.map((initials) => (
              <span
                key={initials}
                className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[9px] font-semibold text-muted-foreground"
              >
                {initials}
              </span>
            ))}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-0.5 text-amber-500">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className="size-3 fill-current" aria-hidden="true" />
              ))}
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              QA-MOTION-HERO · trusted by 4,200 builders
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
`,
  },
  {
    marker: "QA-LANDING-PAGE",
    title: "QA Landing Page",
    description: "A full landing page: nav, hero, feature grid, quote and footer in one file.",
    category: "marketing",
    dependencies: ["motion", "lucide-react"],
    code: `"use client";

import { motion } from "motion/react";
import { ArrowUpRight, Check, Command, Layers, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Built, not screenshotted",
    body: "Every component is compiled and rendered before it is published, so the preview is the real thing.",
  },
  {
    icon: Layers,
    title: "Installs as source",
    body: "One command writes the files, the primitives and the npm packages into your project.",
  },
  {
    icon: Command,
    title: "Own the code",
    body: "No runtime, no lock-in, no wrapper. You get the component, then you change it.",
  },
];

const TIERS = [
  { name: "Free", price: "$0", note: "Browse and install", features: ["Public registry", "Source files"] },
  { name: "Pro", price: "$12", note: "For shipping teams", features: ["Private blocks", "Early drops", "Priority builds"], highlight: true },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="flex size-6 items-center justify-center rounded-md bg-foreground text-[10px] font-bold text-background">
              S
            </span>
            shadway
          </div>
          <nav className="hidden items-center gap-5 text-xs text-muted-foreground sm:flex">
            <a href="#" className="transition-colors hover:text-foreground">Components</a>
            <a href="#" className="transition-colors hover:text-foreground">Creators</a>
            <a href="#" className="transition-colors hover:text-foreground">Pricing</a>
          </nav>
          <a
            href="#"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-xs font-medium transition-colors hover:bg-muted"
          >
            Sign in
            <ArrowUpRight className="size-3" aria-hidden="true" />
          </a>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-6 pt-20 pb-16 text-center">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase"
          >
            QA-LANDING-PAGE
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.06 }}
            className="mx-auto mt-5 max-w-2xl text-balance text-5xl font-semibold tracking-[-0.035em]"
          >
            The interface layer your product deserves
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mx-auto mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground"
          >
            Components, blocks and whole pages, published by the people who built
            them and installable as source.
          </motion.p>
          <div className="mt-7 flex items-center justify-center gap-2">
            <a href="#" className="inline-flex h-9 items-center rounded-md bg-foreground px-4 text-xs font-medium text-background">
              Start browsing
            </a>
            <a href="#" className="inline-flex h-9 items-center rounded-md border border-border px-4 text-xs font-medium hover:bg-muted">
              Read the docs
            </a>
          </div>
        </section>

        <section className="border-y border-border/60 bg-muted/20">
          <div className="mx-auto grid max-w-5xl gap-px bg-border/60 px-6 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }, index) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="bg-background px-5 py-8"
              >
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="mt-3 text-sm font-medium">{title}</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 py-16 text-center">
          <blockquote className="text-balance text-xl font-medium tracking-tight">
            “We replaced three internal design libraries with this registry in a
            fortnight.”
          </blockquote>
          <p className="mt-3 text-xs text-muted-foreground">R. Singh — Head of Design, Northwind</p>
        </section>

        <section className="mx-auto grid max-w-3xl gap-3 px-6 pb-20 sm:grid-cols-2">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={
                "rounded-xl border p-5 " +
                (tier.highlight
                  ? "border-foreground/20 bg-foreground text-background shadow-lg"
                  : "border-border bg-background")
              }
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-medium">{tier.name}</h2>
                <p className="text-2xl font-semibold tracking-tight">{tier.price}</p>
              </div>
              <p className={"mt-1 text-xs " + (tier.highlight ? "text-background/70" : "text-muted-foreground")}>
                {tier.note}
              </p>
              <ul className="mt-4 space-y-1.5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-1.5 text-xs">
                    <Check className="size-3" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 text-[11px] text-muted-foreground">
          <span>© 2026 shadway</span>
          <span>Built with the same sandbox you are looking at.</span>
        </div>
      </footer>
    </div>
  );
}
`,
  },
];

const BROKEN = {
  title: "QA Broken Import",
  code: `import { thing } from "./not-a-real-file";

export default function Broken() {
  return <div>{thing}</div>;
}
`,
};

/**
 * How many components the table holds for a condition.
 *
 * The old check asked the collection for a count; the table is asked the same
 * question, and the answer is the same number for the same reason: a fixture
 * that was never stored is a row that is not there.
 */
async function countComponents(where: SQL): Promise<number> {
  const rows = await db().select({ n: count() }).from(componentsTable).where(where);
  return rows[0]?.n ?? 0;
}

async function main() {
  const suffix = Math.random().toString(36).slice(2, 7);
  const published: string[] = [];

  /**
   * An admin, deliberately.
   *
   * A regular account's publish is `status: "pending"` and stays off every
   * public surface until review — correct, and covered by `qa-profile.ts`.
   * Here the subject is the build and the published document, so the fixture
   * takes the path that publishes immediately; going through review would mean
   * testing the same pipeline one approval later.
   *
   * The account is written to the table the application reads, so the publish
   * below is a publish the application can actually see: a fixture left in the
   * database it used to live in would fail every assertion here for a reason
   * that has nothing to do with publishing.
   */
  const account = await createQaAccount("admin");
  const handle = account.username;

  try {
    await login(account.email, account.password);
    const session = await (await request("/api/auth/session")).json().catch(() => ({}));
    if (!session?.user?.id) throw new Error("could not sign in as the fixture admin");
    log("fixture admin signs in", true, `username=${handle}`);

    const timings: string[] = [];

    for (const fixture of FIXTURES) {
      const slug = `qa-${fixture.marker.toLowerCase()}-${suffix}`;
      const buildInput = {
        title: fixture.title,
        code: fixture.code,
        componentPath: "/components/component.tsx",
        files: fixture.files,
      };

      // --- 1. build + screenshot, exactly as the studio does ---------------
      const buildStart = performance.now();
      const buildRes = await request("/api/studio/build-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildInput),
      });
      const buildBody = await buildRes.json().catch(() => ({}));
      const buildMs = ms(buildStart);

      log(
        `${fixture.title} builds`,
        buildRes.status === 200,
        `status=${buildRes.status} ${buildMs}ms` +
          (buildBody.error ? ` error=${buildBody.error}` : "")
      );
      if (buildRes.status !== 200) continue;

      log(
        `${fixture.title} is within the build budget`,
        buildMs < BUILD_BUDGET_MS,
        `${buildMs}ms < ${BUILD_BUDGET_MS}ms`
      );
      // A blank capture is a warning by design (client-only components render
      // late); what matters is that the pipeline answered, not that a cover came
      // back for every fixture.
      log(
        `${fixture.title} reports its cover honestly`,
        Boolean(buildBody.thumbnailUrl) || Boolean(buildBody.warning),
        buildBody.thumbnailUrl
          ? "captured"
          : `warning=${String(buildBody.warning).slice(0, 60)}`
      );

      // --- 2. publish ------------------------------------------------------
      const publishStart = performance.now();
      const publishRes = await request("/api/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          title: fixture.title,
          description: fixture.description,
          category: fixture.category,
          tags: ["qa", "publish-flow"],
          dependencies: fixture.dependencies,
          componentPath: "/components/component.tsx",
          code: fixture.code,
          files: fixture.files,
          thumbnailUrl: buildBody.thumbnailUrl ?? "",
        }),
      });
      const publishBody = await publishRes.json().catch(() => ({}));
      const publishMs = ms(publishStart);

      const storedSlug = publishBody?.item?.slug as string | undefined;
      if (storedSlug) published.push(storedSlug);

      log(
        `${fixture.title} publishes`,
        publishRes.status === 201 && Boolean(storedSlug),
        `status=${publishRes.status} slug=${storedSlug} ${publishMs}ms`
      );
      log(
        `${fixture.title} is live immediately for an admin`,
        publishBody?.item?.status === "published",
        `status=${publishBody?.item?.status}`
      );
      if (!storedSlug) continue;

      // --- 3. the published document --------------------------------------
      const firstStart = performance.now();
      const firstRes = await request(
        `/api/components/preview?slug=${encodeURIComponent(storedSlug)}`
      );
      const firstHtml = await firstRes.text();
      const firstMs = ms(firstStart);

      log(
        `${fixture.title} renders a document`,
        firstRes.status === 200,
        `status=${firstRes.status} ${firstMs}ms ${Math.round(firstHtml.length / 1024)}KB`
      );
      log(
        `${fixture.title} document is HTML`,
        (firstRes.headers.get("content-type") ?? "").includes("text/html")
      );
      log(
        `${fixture.title} document contains the component`,
        firstHtml.includes(fixture.marker)
      );
      log(
        `${fixture.title} first view is within budget`,
        firstMs < FIRST_VIEW_BUDGET_MS,
        `${firstMs}ms < ${FIRST_VIEW_BUDGET_MS}ms`
      );

      if (fixture.cdnDependency) {
        log(
          `${fixture.title} hands an uninstalled package to the import map`,
          firstHtml.includes(`esm.sh/${fixture.cdnDependency}`),
          `looking for esm.sh/${fixture.cdnDependency}`
        );
      }

      // --- 4. a warm view is a 304 ----------------------------------------
      const etag = firstRes.headers.get("etag");
      log(`${fixture.title} publishes an ETag`, Boolean(etag), `etag=${etag}`);
      if (etag) {
        const warmStart = performance.now();
        const warmRes = await request(
          `/api/components/preview?slug=${encodeURIComponent(storedSlug)}`,
          { headers: { "If-None-Match": etag } }
        );
        const warmMs = ms(warmStart);
        log(
          `${fixture.title} answers 304 when unchanged`,
          warmRes.status === 304,
          `status=${warmRes.status} ${warmMs}ms`
        );
        timings.push(
          `${fixture.title.padEnd(24)} ${String(buildMs).padStart(6)}ms ${String(
            publishMs
          ).padStart(6)}ms ${String(firstMs).padStart(6)}ms ${String(warmMs).padStart(5)}ms`
        );
      } else {
        timings.push(
          `${fixture.title.padEnd(24)} ${String(buildMs).padStart(6)}ms ${String(
            publishMs
          ).padStart(6)}ms ${String(firstMs).padStart(6)}ms     -`
        );
      }

      // --- 5. the registry item -------------------------------------------
      const registryRes = await fetch(`${BASE}/r/${storedSlug}`);
      const registryBody = await registryRes.json().catch(() => null);
      log(
        `${fixture.title} has a registry item`,
        registryRes.status === 200 && Boolean(registryBody),
        `status=${registryRes.status}`
      );
      log(
        `${fixture.title} registry item has files`,
        Array.isArray(registryBody?.files) && registryBody.files.length > 0,
        `files=${registryBody?.files?.length ?? 0}`
      );

      /**
       * The item's dependency list is a *superset* of what the author declared,
       * and has to be: a component importing `@/components/ui/dialog` needs the
       * Radix package that file imports, and the author never types that name.
       * Asserting equality would fail a correct item and, worse, would have to be
       * loosened later into something that proves nothing.
       */
      const itemDependencies: string[] = Array.isArray(registryBody?.dependencies)
        ? registryBody.dependencies.map(String)
        : [];
      const missing = fixture.dependencies.filter(
        (dep) => !itemDependencies.includes(dep)
      );
      log(
        `${fixture.title} registry item keeps the declared dependencies`,
        missing.length === 0,
        `missing=${JSON.stringify(missing)} dependencies=${JSON.stringify(itemDependencies)}`
      );

      /**
       * The install question, and the one that actually breaks people.
       *
       * `shadcn add` writes the item's files and installs its packages. If the
       * component imports `@/components/ui/dialog` and the item neither ships
       * that file nor names it as a registry dependency, the install succeeds
       * and the project does not compile — the consumer's first `next dev`
       * reports a module that does not exist, and the component's page is the
       * thing that breaks.
       */
      const uiImports = [
        ...new Set(
          [...fixture.code.matchAll(/from\s+["']@\/components\/ui\/([a-z0-9-]+)["']/g)].map(
            (match) => match[1]
          )
        ),
      ];
      const itemPaths: string[] = Array.isArray(registryBody?.files)
        ? registryBody.files.map((file: { path: string }) => String(file.path))
        : [];
      const itemRegistryDependencies: string[] = Array.isArray(
        registryBody?.registryDependencies
      )
        ? registryBody.registryDependencies.map(String)
        : [];
      const unresolvedUi = uiImports.filter(
        (name) =>
          !itemPaths.some((path) => path.replace(/\\/g, "/").endsWith(`/${name}.tsx`)) &&
          !itemRegistryDependencies.some((dep) => {
            // An entry may be a bare upstream name (`button`), an absolute URL
            // (`https://host/r/button`), or an `@registry/button` reference.
            // All three address the same item, so compare on the last segment.
            const terminal = (dep.split("/").pop() ?? "").replace(/\.json$/, "");
            return terminal === name;
          })
      );
      if (uiImports.length) {
        log(
          `${fixture.title} ships or names every UI file it imports`,
          unresolvedUi.length === 0,
          `imports=${JSON.stringify(uiImports)} unresolved=${JSON.stringify(unresolvedUi)}`
        );
      }

      log(
        `${fixture.title} registry item names its author`,
        registryBody?.meta?.author === handle,
        `author=${registryBody?.meta?.author}`
      );

      // --- 6. the page a buyer actually opens -----------------------------
      const detailRes = await fetch(`${BASE}/c/${storedSlug}`);
      const detailHtml = await detailRes.text();
      log(
        `${fixture.title} detail page renders`,
        detailRes.status === 200 && detailHtml.includes(fixture.title),
        `status=${detailRes.status}`
      );
    }

    // --- 7. a broken component is refused, and not stored -----------------
    const brokenRes = await request("/api/studio/build-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: BROKEN.title,
        code: BROKEN.code,
        componentPath: "/components/component.tsx",
      }),
    });
    const brokenBody = await brokenRes.json().catch(() => ({}));
    log(
      "a component that does not compile is refused",
      brokenRes.status === 422 && brokenBody.step === "build",
      `status=${brokenRes.status} step=${brokenBody.step}`
    );
    log(
      "the refusal carries the compiler's own message",
      typeof brokenBody.error === "string" && brokenBody.error.includes("not-a-real-file"),
      `error=${brokenBody.error}`
    );
    log(
      "the broken component was not stored",
      (await countComponents(eq(componentsTable.title, BROKEN.title))) === 0
    );

    // --- 8. one republish, to prove the address is stable ----------------
    const first = published[0];
    if (first) {
      const body = FIXTURES[0];
      const updateRes = await request("/api/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: `${first}-renamed`,
          draftSlug: first,
          title: `${body.title} (Renamed)`,
          description: body.description,
          category: body.category,
          tags: ["qa", "publish-flow"],
          dependencies: body.dependencies,
          componentPath: "/components/component.tsx",
          code: body.code,
        }),
      });
      const updateBody = await updateRes.json().catch(() => ({}));
      log(
        "an author can rename the registry URL",
        updateRes.status === 201 && updateBody?.item?.slug === `${first}-renamed`,
        `status=${updateRes.status} slug=${updateBody?.item?.slug}`
      );
      log(
        "the old address is gone, not duplicated",
        (await countComponents(eq(componentsTable.slug, first))) === 0
      );
      if (updateBody?.item?.slug) published[0] = updateBody.item.slug;
    }

    // --- timings ---------------------------------------------------------
    console.log("\n  fixture                    build publish  first  warm");
    for (const row of timings) console.log(`  ${row}`);
  } finally {
    /**
     * `KEEP=1` leaves the fixtures behind.
     *
     * A harness that always cleans up can assert the *existence* of a broken
     * registry item but not show it to you, and the difference between "the
     * assertion failed" and "here is the document" is most of the debugging.
     */
    if (process.env.KEEP !== "1") {
      /**
       * The components go with the account.
       *
       * Every component this run published carries the fixture's id in its
       * author record, so the account and the rows that name it are removed
       * together — and exactly the components this run wrote go with it, which
       * a delete by title or by slug only ever approximates.
       */
      await removeQaAccount(account.email);
    } else {
      console.log(`\n  kept fixtures for @${handle} (suffix ${suffix})`);
    }
  }

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
