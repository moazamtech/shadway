import "dotenv/config";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import puppeteer from "puppeteer";

import { BASE, createQaAccount, removeQaAccount } from "./qa-session";

/**
 * The other half of the registry contract: what a consumer actually gets.
 *
 * `qa-publish-flow.ts` proves an item is *served*. This proves an item is
 * *installed* — by running the real `shadcn` CLI, out of the project's own
 * `node_modules`, against a scratch Next project with nothing but a
 * `components.json` and a `tsconfig.json`.
 *
 * That difference matters because the two surfaces disagree in ways neither one
 * shows alone. The item can be perfect JSON and still install every file into
 * the wrong directory: given no `files[].target`, the CLI derives the folder
 * from `type` and the *filename* from `path`, so `components/pricing/hero.tsx`
 * and `components/pricing/hero-demo.tsx` both land in `components/` and the
 * second silently replaces the first. The file list is still complete, the
 * schema still passes, and the consumer's project is broken.
 *
 * So the assertions here are about the project on disk after the CLI exits:
 *
 *   - the source file is at `components/ui/<slug>.tsx` for a UI item and at
 *     `components/<slug>.tsx` for a block
 *   - the author's nested files kept their directories
 *   - the `components/ui/*` primitives the source imports were installed too
 *   - every npm package the installed code imports is in its package.json
 *   - every `@/…` import in every installed file resolves to a real file
 *
 * Run with a dev server up:
 *   npx tsx scripts/qa-install.ts
 */

const CLI = path.join(process.cwd(), "node_modules", "shadcn", "dist", "index.js");
const INSTALL_BUDGET_MS = 300_000;

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((candidate) => existsSync(candidate));

type CookieJar = Record<string, string>;
const jar: CookieJar = {};

function cookieHeader() {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function collectCookies(res: Response) {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw: string[] = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const cookie of raw) {
    const first = cookie.split(";")[0];
    const idx = first.indexOf("=");
    if (idx <= 0) continue;
    jar[first.slice(0, idx).trim()] = first.slice(idx + 1).trim();
  }
}

async function request(input: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("cookie", cookieHeader());
  const res = await fetch(`${BASE}${input}`, { ...init, headers, redirect: "manual" });
  collectCookies(res);
  return res;
}

async function login(email: string, password: string) {
  const csrf = await (await request("/api/auth/csrf")).json();
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

/**
 * The CLI is long-running — an npm install, often two minutes — and
 * `spawnSync` blocks this process's event loop for all of it. The pooled
 * keep-alive sockets to the dev server then die unserviced and the next
 * request fails with `ECONNRESET`, which looks exactly like the server
 * crashing. Async spawn keeps the loop turning.
 */
function runCli(args: string[]): Promise<{ status: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: process.cwd() });
    let output = "";
    child.stdout?.on("data", (chunk) => (output += String(chunk)));
    child.stderr?.on("data", (chunk) => (output += String(chunk)));
    const timer = setTimeout(() => child.kill(), INSTALL_BUDGET_MS);
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, output });
    });
  });
}

/**
 * A component published seconds ago is the only case that exercises the
 * minute boundary in the card's relative timestamp, and it is the case a
 * hydration mismatch used to destroy the tree for. Loading the feed right
 * after publishing is the whole test.
 */
async function checkHydration(url: string, expected: string) {
  if (!CHROME) return { ok: false, detail: "Chrome not found" };
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    const mismatches: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /hydrat/i.test(message.text())) {
        mismatches.push(message.text().slice(0, 160));
      }
    });
    page.on("pageerror", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (/hydrat/i.test(message)) mismatches.push(message.slice(0, 160));
    });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60_000 });
    const text = await page.evaluate(() => document.body.innerText);
    return {
      ok: mismatches.length === 0 && text.includes(expected),
      detail: mismatches.length
        ? mismatches[0]
        : text.includes(expected)
          ? "rendered"
          : "component missing from the feed",
    };
  } finally {
    await browser.close();
  }
}

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

type Fixture = {
  marker: string;
  title: string;
  category: "ui" | "marketing";
  code: string;
  files?: { path: string; content: string }[];
  /** Where the source file must land after `shadcn add`. */
  expectedSource: (slug: string) => string;
  /** Author files that must survive with their directories intact. */
  expectedFiles: string[];
};

const STAT_FILE = `export type Stat = { label: string; value: number };

export function formatCount(value: number) {
  return value.toLocaleString("en-US");
}
`;

const PANEL_FILE = `export function InstallPanel() {
  return (
    <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
      Installed from shadway, second file, flat path.
    </p>
  );
}
`;

/**
 * A UI item that reaches for everything the registry has to get right: a
 * primitive it ships itself, two it must ask shadcn for, an npm animation
 * package, and two author files — one nested, one flat.
 */
const UI_FIXTURE: Fixture = {
  marker: "install-kit",
  title: "QA Install Kit",
  category: "ui",
  code: `"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCount, type Stat } from "./install/deep/stat";
import { InstallPanel } from "./install-panel";

const stats: Stat[] = [
  { label: "Installs", value: 1234 },
  { label: "Creators", value: 56 },
];

export default function InstallKit() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex max-w-xl flex-col gap-4 rounded-xl border border-border bg-background p-6"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Install kit</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm">Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Installed</DialogTitle>
              <DialogDescription>This dialog came from shadway.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </header>
      <div className="grid grid-cols-2 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border p-3">
            <p className="text-lg font-semibold tabular-nums">{formatCount(stat.value)}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
      <InstallPanel />
    </motion.section>
  );
}
`,
  files: [
    { path: "/components/install/deep/stat.tsx", content: STAT_FILE },
    { path: "/components/install-panel.tsx", content: PANEL_FILE },
  ],
  expectedSource: (slug) => `components/ui/${slug}.tsx`,
  // The studio builds at `components/component.tsx`, so the source moving into
  // `components/ui/` takes its neighbours with it — otherwise `./install-panel`
  // is a module the CLI never wrote.
  expectedFiles: ["components/ui/install/deep/stat.tsx", "components/ui/install-panel.tsx"],
};

/** A block: same registry, different destination. */
const BLOCK_FIXTURE: Fixture = {
  marker: "install-block",
  title: "QA Install Block",
  category: "marketing",
  code: `export default function InstallBlock() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Install block
      </p>
      <h2 className="mt-4 text-4xl font-semibold tracking-tight">A landing page section</h2>
      <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
        Installed straight into components/ because blocks are not primitives.
      </p>
    </section>
  );
}
`,
  expectedSource: (slug) => `components/${slug}.tsx`,
  expectedFiles: [],
};

/* ------------------------------------------------------------------ */
/* The scratch project                                                 */
/* ------------------------------------------------------------------ */

async function createScratchProject() {
  const dir = await mkdtemp(path.join(tmpdir(), "shadway-install-"));
  await mkdir(path.join(dir, "app"), { recursive: true });
  await mkdir(path.join(dir, "lib"), { recursive: true });

  await writeFile(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: "shadway-install-check",
        private: true,
        version: "0.0.0",
        dependencies: {
          next: "16.4.2",
          react: "19.2.0",
          "react-dom": "19.2.0",
          tailwindcss: "^4.1.0",
        },
        devDependencies: {
          typescript: "^5.7.0",
          "@types/node": "^22.10.0",
          "@types/react": "^19.0.0",
          "@types/react-dom": "^19.0.0",
        },
      },
      null,
      2
    )
  );

  await writeFile(
    path.join(dir, "components.json"),
    JSON.stringify(
      {
        $schema: "https://ui.shadcn.com/schema.json",
        style: "new-york",
        rsc: true,
        tsx: true,
        tailwind: {
          config: "",
          css: "app/globals.css",
          baseColor: "neutral",
          cssVariables: true,
          prefix: "",
        },
        iconLibrary: "lucide",
        aliases: {
          components: "@/components",
          utils: "@/lib/utils",
          ui: "@/components/ui",
          lib: "@/lib",
          hooks: "@/hooks",
        },
      },
      null,
      2
    )
  );

  await writeFile(
    path.join(dir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          plugins: [{ name: "next" }],
          paths: { "@/*": ["./*"] },
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        exclude: ["node_modules"],
      },
      null,
      2
    )
  );

  await writeFile(path.join(dir, "app", "globals.css"), '@import "tailwindcss";\n');
  await writeFile(
    path.join(dir, "lib", "utils.ts"),
    `import { clsx, type ClassValue } from "clsx";\nimport { twMerge } from "tailwind-merge";\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs));\n}\n`
  );

  return dir;
}

/* ------------------------------------------------------------------ */
/* Static checks over what landed on disk                              */
/* ------------------------------------------------------------------ */

/** `@/components/ui/button` → candidates under the project root. */
function resolvesToFile(root: string, specifier: string): boolean {
  const rel = specifier.replace(/^@\//, "");
  const base = path.join(root, rel);
  return [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    path.join(base, "index.tsx"),
    path.join(base, "index.ts"),
  ].some((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

/** Every module string literal in a source file, roughly but usefully. */
function importsOf(source: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /^\s*import\s+["']([^"']+)["']/gm,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.add(match[1]);
  }
  return [...found];
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

/** `@scope/pkg/sub` → `@scope/pkg`; `motion/react` → `motion`. */
function packageNameOf(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

const HOST = new Set(["react", "react-dom", "next"]);

/* ------------------------------------------------------------------ */

async function main() {
  if (!existsSync(CLI)) throw new Error(`shadcn CLI not found at ${CLI}`);

  const suffix = Math.random().toString(36).slice(2, 8);
  let scratch: string | null = null;

  /**
   * The publisher's account, in the database the application reads.
   *
   * The CLI installs what the registry serves, and the registry serves what
   * the application stored, so the account that publishes has to be an account
   * the application knows about. One minted in a database it no longer reads
   * would publish nothing, and the install below would then be checking an
   * empty shelf.
   */
  const account = await createQaAccount("admin");
  const handle = account.username;

  try {
    await login(account.email, account.password);
    const session = await (await request("/api/auth/session")).json().catch(() => ({}));
    if (!session?.user?.id) throw new Error("could not sign in as the fixture admin");
    log("fixture admin signs in", true, `username=${handle}`);

    for (const fixture of [UI_FIXTURE, BLOCK_FIXTURE]) {
      const slug = "qa-" + fixture.marker + "-" + suffix;
      const label = fixture.title;

      // --- publish it, through the same two requests the studio makes ------
      const buildRes = await request("/api/studio/build-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fixture.title,
          code: fixture.code,
          componentPath: "/components/component.tsx",
          files: fixture.files,
        }),
      });
      const buildBody = await buildRes.json().catch(() => ({}));
      log(`${label} builds`, buildRes.status === 200, `status=${buildRes.status}` + (buildBody.error ? ` error=${buildBody.error}` : ""));
      if (buildRes.status !== 200) continue;

      const publishRes = await request("/api/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          title: fixture.title,
          description: "A component published only to install itself back.",
          category: fixture.category,
          code: fixture.code,
          componentPath: "/components/component.tsx",
          files: fixture.files,
          tags: ["qa", "install"],
          thumbnailUrl: buildBody.thumbnailUrl,
        }),
      });
      if (publishRes.status !== 201) {
        log(`${label} publishes`, false, `status=${publishRes.status}`);
        continue;
      }

      if (fixture === UI_FIXTURE) {
        const hydration = await checkHydration(`${BASE}/`, fixture.title);
        log(
          `${label} renders on the feed without a hydration mismatch`,
          hydration.ok,
          hydration.detail
        );
      }

      // --- the item, before the CLI sees it -------------------------------
      const itemRes = await request(`/r/${slug}`);
      const item = await itemRes.json().catch(() => ({}));
      const targets = (item?.files ?? []).map((file: { target?: string }) => file.target);
      const expected = [fixture.expectedSource(slug), ...fixture.expectedFiles];
      log(
        `${label} declares a target for every file`,
        itemRes.status === 200 && targets.length > 0 && targets.every(Boolean),
        `targets=${JSON.stringify(targets)}`
      );
      log(
        `${label} targets the paths the CLI must write`,
        expected.every((p) => targets.includes(p)),
        expected.filter((p) => !targets.includes(p)).length
          ? `missing=${JSON.stringify(expected.filter((p) => !targets.includes(p)))}`
          : "all present"
      );

      // --- the install ----------------------------------------------------
      if (!scratch) scratch = await createScratchProject();
      const installStart = performance.now();
      const run = await runCli([
        CLI,
        "add",
        `${BASE}/r/${slug}`,
        "--yes",
        "--overwrite",
        "--cwd",
        scratch,
      ]);
      const installMs = ms(installStart);
      const output = run.output;
      log(
        `${label} installs with shadcn add`,
        run.status === 0,
        `exit=${run.status} ${installMs}ms`
      );
      if (run.status !== 0) {
        console.log(output.split("\n").slice(-25).join("\n"));
        continue;
      }

      // --- what is actually on disk ---------------------------------------
      const source = fixture.expectedSource(slug);
      log(`${label} installs its source at ${source}`, existsSync(path.join(scratch, source)));
      log(
        `${label} does not leave a flattened copy behind`,
        !existsSync(path.join(scratch, "components", `${slug}.tsx`)) ||
          fixture.expectedSource(slug) === `components/${slug}.tsx`
      );
      for (const file of fixture.expectedFiles) {
        log(`${label} installs ${file}`, existsSync(path.join(scratch, file)));
      }

      if (fixture === UI_FIXTURE) {
        log(
          `${label} installs the primitives its source imports`,
          existsSync(path.join(scratch, "components", "ui", "button.tsx")) &&
            existsSync(path.join(scratch, "components", "ui", "dialog.tsx"))
        );

        const pkg = JSON.parse(readFileSync(path.join(scratch, "package.json"), "utf8"));
        const installedDeps = new Set([
          ...Object.keys(pkg.dependencies ?? {}),
          ...Object.keys(pkg.devDependencies ?? {}),
        ]);
        for (const dep of ["motion", "@radix-ui/react-dialog", "class-variance-authority"]) {
          log(`${label} adds ${dep} to the consumer's package.json`, installedDeps.has(dep));
        }
      }

      // --- nothing installed may import a module that is not there ---------
      const installedSources = walkFiles(path.join(scratch, "components")).filter((file) =>
        /\.(tsx|ts|jsx|js)$/.test(file)
      );
      const unresolved = new Set<string>();
      const missingPackages = new Set<string>();
      const pkg = JSON.parse(readFileSync(path.join(scratch, "package.json"), "utf8"));
      const declared = new Set([
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
      ]);

      for (const file of installedSources) {
        for (const specifier of importsOf(readFileSync(file, "utf8"))) {
          if (specifier.startsWith(".")) {
            const base = path.resolve(path.dirname(file), specifier);
            const ok = [
              base,
              `${base}.tsx`,
              `${base}.ts`,
              path.join(base, "index.tsx"),
              path.join(base, "index.ts"),
            ].some((candidate) => existsSync(candidate));
            if (!ok) unresolved.add(`${path.relative(scratch, file)} → ${specifier}`);
            continue;
          }
          if (specifier.startsWith("@/")) {
            if (!resolvesToFile(scratch, specifier)) {
              unresolved.add(`${path.relative(scratch, file)} → ${specifier}`);
            }
            continue;
          }
          const name = packageNameOf(specifier);
          if (HOST.has(name)) continue;
          if (!declared.has(name)) missingPackages.add(name);
        }
      }

      log(
        `${label} installs every module its files import`,
        unresolved.size === 0,
        unresolved.size ? [...unresolved].slice(0, 6).join(" | ") : `checked ${installedSources.length} files`
      );
      log(
        `${label} declares every npm package its files import`,
        missingPackages.size === 0,
        missingPackages.size ? `missing=${[...missingPackages].join(",")}` : "none missing"
      );
    }
  } finally {
    if (scratch) await rm(scratch, { recursive: true, force: true }).catch(() => {});
    // The published components go with the account that published them: the
    // author is a record on the component, so the two are removed together.
    await removeQaAccount(account.email);
  }

  console.log("");
  console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

void main();
