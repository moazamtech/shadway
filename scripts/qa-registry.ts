import "dotenv/config";

/**
 * The registry audit.
 *
 * The sandbox and the publish build are only as good as the worst item they
 * are handed, and "the worst item" is not knowable from the vendored corpus:
 * that folder holds 61 `ui` sources, while the public registry ships 471 items
 * — 97 blocks, 239 examples, 70 charts, 52 fonts — written by people who were
 * not thinking about this sandbox. A block reaches for `@dnd-kit/sortable` and
 * `@tanstack/react-table`; an example imports `recharts`; a page reads a
 * `data.json` next to it. None of that appears in a `ui` component.
 *
 * So this fetches real items from the public registry and runs each one
 * through the *same* pipeline the studio runs an author's project through, in
 * the same order:
 *
 *   1. canonicalise   registry paths -> the layout a shadcn project installs
 *   2. import walk    `withShadcnFiles` mounts the vendored `ui` sources
 *   3. stylesheet     `compileProjectCssCached` compiles the project's CSS
 *   4. sandbox        `buildSandpackProject` emits the file map Sandpack gets
 *   5. publish        `buildComponentBundle` bundles it with esbuild
 *
 * Every stage is timed, every failure is reported with its reason, and the
 * whole run is dumped as JSON so the failures can be clustered rather than
 * read one at a time.
 *
 *   npx tsx scripts/qa-registry.ts                      # every block, then examples, then ui
 *   npx tsx scripts/qa-registry.ts --group block
 *   npx tsx scripts/qa-registry.ts --only dashboard-01,chart-bar-demo
 *   npx tsx scripts/qa-registry.ts --group example --limit 40
 */

import { buildComponentBundle } from "../lib/preview/build";
import { SHADCN_FILES } from "../lib/preview/template/bundle";
import { installedPathFor } from "../lib/preview/shadcn-ui";
import { compileProjectCssCached } from "../lib/preview/tailwind";
import { SANDBOX_PACKAGE_VERSIONS, collectNpmDependencies } from "../lib/studio/deps";
import { buildSandpackProject } from "../lib/studio/sandpack";
import { DEFAULT_STYLE_CODE } from "../lib/studio/starter";

/* -------------------------------------------------------------- registry -- */

const REGISTRY = "https://ui.shadcn.com/r/styles/new-york-v4";

type RegistryFile = { path: string; content?: string; type?: string };

type RegistryItem = {
  name: string;
  type: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: RegistryFile[];
};

type IndexEntry = {
  name: string;
  type: string;
  dependencies?: string[];
  registryDependencies?: string[];
};

const ITEM_CACHE = new Map<string, RegistryItem | null>();

async function fetchItem(name: string): Promise<RegistryItem | null> {
  const key = name.replace(/^@[\w-]+\//, "");
  if (ITEM_CACHE.has(key)) return ITEM_CACHE.get(key) as RegistryItem | null;

  const response = await fetch(`${REGISTRY}/${key}.json`);
  if (!response.ok) {
    ITEM_CACHE.set(key, null);
    return null;
  }

  const item = (await response.json()) as RegistryItem;
  ITEM_CACHE.set(key, item);
  return item;
}

/**
 * An item and everything it depends on, transitively.
 *
 * `registryDependencies` are the pieces shadcn would install alongside — the
 * `sidebar` a block is built from, the `use-mobile` hook it reads. They are
 * almost always plain names; the `@namespace/name` spelling means "from
 * another registry", which this audit cannot build, so those are recorded and
 * skipped rather than silently dropped.
 */
async function collectItem(
  name: string,
  seen = new Set<string>(),
  foreign: Set<string> = new Set()
): Promise<{ item: RegistryItem; deps: RegistryItem[]; foreign: string[] }> {
  const item = await fetchItem(name);
  if (!item) throw new Error(`registry has no item named "${name}"`);

  const deps: RegistryItem[] = [];
  const queue = [...(item.registryDependencies ?? [])];
  seen.add(item.name);

  while (queue.length) {
    const dependency = queue.shift() as string;
    if (/^https?:\/\//.test(dependency)) {
      foreign.add(dependency);
      continue;
    }
    if (/^@/.test(dependency) && !dependency.startsWith("@/")) {
      foreign.add(dependency);
      continue;
    }

    const key = dependency.replace(/^@\/registry\/new-york-v4\//, "");
    if (seen.has(key)) continue;
    seen.add(key);

    const resolved = await fetchItem(key);
    if (!resolved) {
      foreign.add(dependency);
      continue;
    }

    deps.push(resolved);
    for (const nested of resolved.registryDependencies ?? []) queue.push(nested);
  }

  return { item, deps, foreign: [...foreign] };
}

/* -------------------------------------------------------- canonicalising -- */

const BLOCKS = /^registry\/new-york-v4\/blocks\/([^/]+)\/(.+)$/;

/** The block an item's files belong to, if they belong to one. */
function blockOf(path: string): string | null {
  return BLOCKS.exec(path)?.[1] ?? null;
}

/**
 * A registry path, as the project path a real `shadcn add` would write it to.
 *
 *   ui/button.tsx                          -> /components/ui/button.tsx
 *   hooks/use-mobile.ts                    -> /hooks/use-mobile.ts
 *   lib/utils.ts                           -> /lib/utils.ts
 *   examples/chart-bar-demo.tsx            -> /app/page.tsx
 *   charts/chart-area-axes.tsx             -> /components/charts/chart-area-axes.tsx
 *   blocks/sidebar-01/page.tsx             -> /app/sidebar-01/page.tsx
 *   blocks/sidebar-01/components/x.tsx     -> /components/sidebar-01/x.tsx
 *   blocks/sidebar-01/data.json            -> /app/sidebar-01/data.json
 *
 * A block's page keeps its own route — `app/<block>/page.tsx`, which is what
 * `shadcn add` writes — rather than being flattened to `/app/page.tsx`,
 * because flattening it would hide the case the sandbox has to handle: a
 * project whose only page is not `/app/page.tsx`. Its components keep a
 * per-block directory so two blocks' `nav-main.tsx` cannot collide, and
 * `data.json` stays next to the page because that is what the page's
 * `./data.json` import expects.
 */
function projectPathFor(path: string, type: string): string | null {
  const block = blockOf(path);
  const rest = path.replace(/^registry\/new-york-v4\//, "");

  if (rest.startsWith("ui/")) return `/components/${rest}`;
  if (rest.startsWith("hooks/") || rest.startsWith("lib/")) return `/${rest}`;

  if (block) {
    const inner = BLOCKS.exec(path)?.[2] as string;
    if (inner === "page.tsx" || type === "registry:page") return `/app/${block}/page.tsx`;
    if (inner.startsWith("components/")) {
      return `/components/${block}/${inner.slice("components/".length)}`;
    }
    if (inner.endsWith(".tsx") || inner.endsWith(".ts")) {
      return `/components/${block}/${inner}`;
    }
    return `/app/${block}/${inner}`;
  }

  // Examples and charts are single modules. A demo carries its own default
  // export, so it *is* the page; a chart is a named-export component the docs
  // render from a wrapper, so it goes to `components/` and a page is generated
  // for it (see `pageFor`).
  if (rest.startsWith("examples/")) return "/app/page.tsx";
  return `/components/${rest}`;
}

/**
 * The import a registry file writes, rewritten the way the file's new home
 * requires. Every shadcn source addresses its neighbours through the
 * registry's own tree — `@/registry/new-york-v4/ui/sidebar` — and none of
 * those paths exist in a project.
 */
function rewriteRegistryImports(content: string, block: string | null): string {
  return content
    // The registry ships `cn` as a package of its own; every project keeps the
    // same helper at `@/lib/utils`.
    .replace(/(from\s+|import\s*\(\s*)["']cn["']/g, '$1"@/lib/utils"')
    .replace(/@\/registry\/new-york-v4\/ui\//g, "@/components/ui/")
    .replace(/@\/registry\/new-york-v4\/hooks\//g, "@/hooks/")
    .replace(/@\/registry\/new-york-v4\/lib\//g, "@/lib/")
    .replace(
      /@\/registry\/new-york-v4\/blocks\/[^/"]+\/components\//g,
      `@/components/${block ?? ""}/`.replace(/\/$/, "/")
    )
    .replace(/@\/registry\/new-york-v4\/blocks\/[^/"]+\//g, "@/");
}

/** The vendored `ui` source for a registry path, when the studio has one. */
function resolveVendored(item: RegistryItem): { path: string; content: string } | null {
  for (const file of item.files ?? []) {
    const rest = file.path.replace(/^registry\/new-york-v4\//, "");
    const vendored = SHADCN_FILES[rest];
    if (vendored) return { path: installedPathFor(rest), content: vendored };
  }
  return null;
}

/**
 * The named exports a module offers that could be rendered on their own.
 *
 * Chart items are the reason this exists: `charts/chart-area-axes.tsx` exports
 * `ChartAreaAxes` and `description`, and no default, because the docs render it
 * from a wrapper. A shadcn `ui` source is the same shape. Anything that starts
 * with a capital and is not `description` is a component.
 */
function componentExports(content: string): string[] {
  const found = new Set<string>();

  for (const match of content.matchAll(
    /^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/gm
  )) {
    found.add(match[1]);
  }

  for (const group of content.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const raw of group[1].split(",")) {
      const entry = raw.trim();
      if (!entry) continue;

      // `export { type CarouselApi, Carousel }` is how the registry re-exports
      // a type beside its components. A type has no runtime binding, so
      // rendering one does not test the sandbox — it fails the bundle. Taking
      // `CarouselApi` here is what made `carousel` the only `ui` failure.
      if (/^type\s/.test(entry)) continue;

      const name = entry.split(/\s+as\s+/).pop()?.trim();
      if (name) found.add(name);
    }
  }

  return [...found].filter((name) => /^[A-Z]/.test(name) && name !== "Description");
}

/**
 * A page that renders a module which has no default export.
 *
 * This is what the studio's own demo page does for a component an author
 * writes, and it is what the docs do for a chart: mount the named export.
 */
function pageFor(modulePath: string, content: string): string {
  const specifier = `@/${modulePath.replace(/^\//, "").replace(/\.tsx?$/, "")}`;

  if (/(?:^|\n)\s*export\s+default\b/.test(content)) {
    return `import Component from "${specifier}";

export default function Page() {
  return (
    <main className="min-h-screen w-full bg-background text-foreground">
      <Component />
    </main>
  );
}
`;
  }

  const [first] = componentExports(content);
  if (!first) {
    return `import "${specifier}";

export default function Page() {
  return <main className="min-h-screen w-full bg-background text-foreground" />;
}
`;
  }

  return `import { ${first} } from "${specifier}";

export default function Page() {
  return (
    <main className="min-h-screen w-full bg-background text-foreground">
      <${first} />
    </main>
  );
}
`;
}

type Canonical = {
  /** The page first, then everything else. */
  files: { path: string; content: string }[];
  /** npm packages the item itself declares (not its dependencies'). */
  declared: string[];
  foreign: string[];
  skipped: string[];
  /** True when the harness had to write the page rather than take one. */
  generated: boolean;
  /**
   * Relative imports inside the item's own files that nothing can resolve.
   *
   * `form-next-demo` is the case: its page imports `./form-next-demo-action`
   * and `./form-next-demo-schema`, and the registry publishes neither — no
   * item in the index has them — so `shadcn add form-next-demo` produces a
   * project that cannot build either. That is the registry being incomplete,
   * not the sandbox, and it is worth saying so rather than counting it as a
   * failure and waiting for a fix that cannot come from here.
   */
  missingSiblings: string[];
};

function canonicalise(item: RegistryItem, deps: RegistryItem[], foreign: string[]): Canonical {
  const files = new Map<string, { path: string; content: string }>();
  const skipped: string[] = [];

  // Dependencies first, so an item's own file always wins a path collision.
  for (const dependency of [...deps, item]) {
    const isOwn = dependency === item;
    const vendored = resolveVendored(dependency);

    if (vendored) {
      // The vendored source is what the studio mounts for `@/components/ui/*`,
      // so it is the source the sandbox actually compiles. Using it here keeps
      // the audit honest about that, instead of testing the registry's copy.
      if (!isOwn || !files.has(vendored.path)) files.set(vendored.path, vendored);
      continue;
    }

    const block = blockOf((dependency.files ?? [])[0]?.path ?? "");
    for (const file of dependency.files ?? []) {
      if (!file.content) {
        skipped.push(file.path);
        continue;
      }
      const path = projectPathFor(file.path, file.type ?? dependency.type);
      if (!path) {
        skipped.push(file.path);
        continue;
      }
      files.set(path, { path, content: rewriteRegistryImports(file.content, block) });
    }
  }

  let generated = false;
  if (![...files.keys()].some((path) => /^\/app\/(?:.+\/)?page\.tsx$/.test(path))) {
    // The item is a module, not a page. Find the module the item itself
    // contributed and render it, the way the docs or a demo wrapper would.
    const own = (item.files ?? [])
      .map((file) => projectPathFor(file.path, file.type ?? item.type))
      .find((path): path is string => Boolean(path) && files.has(path as string));

    if (own) {
      const entry = files.get(own) as { path: string; content: string };
      files.set("/app/page.tsx", { path: "/app/page.tsx", content: pageFor(entry.path, entry.content) });
      generated = true;
    }
  }

  const page = [...files.values()].find((file) => /^\/app\/(?:.+\/)?page\.tsx$/.test(file.path));
  const rest = [...files.values()]
    .filter((file) => file !== page)
    .sort((a, b) => a.path.localeCompare(b.path));

  const ordered = page ? [page, ...rest] : rest;

  // A relative import inside the item's own files that its own file set does
  // not satisfy. Vendored `ui` sources are not consulted: a block's
  // `./components/x` has to come from the block.
  const ownPaths = new Set(
    (item.files ?? [])
      .map((file) => projectPathFor(file.path, file.type ?? item.type))
      .filter((path): path is string => Boolean(path))
  );
  const paths = new Set(ordered.map((file) => file.path));
  const missingSiblings: string[] = [];

  for (const file of ordered) {
    if (!ownPaths.has(file.path) && file.path !== "/app/page.tsx") continue;
    for (const specifier of specifiers(file.content)) {
      if (!specifier.startsWith("./") && !specifier.startsWith("../")) continue;
      if (!resolvesIn(specifier, file.path, paths)) {
        missingSiblings.push(`${file.path} -> ${specifier}`);
      }
    }
  }

  return {
    files: ordered,
    declared: item.dependencies ?? [],
    foreign,
    skipped,
    generated,
    missingSiblings: [...new Set(missingSiblings)],
  };
}

/* ------------------------------------------------------------------ probes -- */

const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".json", ".css"];

/** Resolves a project-relative specifier against the paths a map has. */
function resolvesIn(specifier: string, fromPath: string, paths: Set<string>): boolean {
  const candidates: string[] = [];

  if (specifier.startsWith("@/")) {
    candidates.push(`/${specifier.slice(2)}`);
  } else if (specifier.startsWith("/")) {
    candidates.push(specifier);
  } else if (specifier.startsWith(".")) {
    const stack = fromPath.split("/").slice(0, -1);
    for (const segment of specifier.split("/")) {
      if (!segment || segment === ".") continue;
      if (segment === "..") stack.pop();
      else stack.push(segment);
    }
    candidates.push(`/${stack.filter(Boolean).join("/")}`);
  } else {
    return true;
  }

  for (const candidate of candidates) {
    if (paths.has(candidate)) return true;
    for (const extension of EXTENSIONS) if (paths.has(candidate + extension)) return true;
    for (const extension of EXTENSIONS) if (paths.has(`${candidate}/index${extension}`)) return true;
  }
  return false;
}

const IMPORT_RE =
  /(?:\bimport\s+(?:[\s\S]*?\sfrom\s*)?|\bexport\s+(?:[\s\S]*?\sfrom\s*)|\bimport\s*\(\s*)(["'])([^"']+)\1/g;

function specifiers(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) found.push(match[2]);
  return found;
}

/** Modules a bare-react sandbox supplies rather than installing. */
const SANDBOX_PROVIDED = new Set(["react", "react-dom", "react-dom/client", "next"]);

/* -------------------------------------------------------------------- run -- */

type Outcome = {
  name: string;
  type: string;
  files: number;
  /** npm packages the item declares. */
  declared: string[];
  /** npm packages the item's sources import. */
  required: string[];
  /** Required packages the sandbox would install at `latest`. */
  unpinned: string[];
  /** Required packages this host has no copy of, so the build defers to a CDN. */
  externals: string[];
  /** Sandbox: relative/alias specifiers with nothing behind them. */
  dangling: string[];
  stage: string;
  reason?: string;
  cssMs: number;
  cssBytes: number;
  sandboxMs: number;
  buildMs: number;
  jsBytes: number;
  foreign: string[];
  skipped: string[];
  /** True when the harness wrote the page instead of the registry shipping one. */
  generatedPage?: boolean;
  /** Imports into files the registry does not ship, when that is the failure. */
  missing?: string[];
  /** Import-map URLs that do not answer 200, when `--cdn` was passed. */
  cdn?: { url: string; status: number }[];
};

async function run(name: string, options: ReturnType<typeof parseArgs>): Promise<Outcome> {
  const started = Date.now();
  const outcome: Outcome = {
    name,
    type: "?",
    files: 0,
    declared: [],
    required: [],
    unpinned: [],
    externals: [],
    dangling: [],
    stage: "resolve",
    cssMs: 0,
    cssBytes: 0,
    sandboxMs: 0,
    buildMs: 0,
    jsBytes: 0,
    foreign: [],
    skipped: [],
  };

  try {
    const { item, deps, foreign } = await collectItem(name);
    outcome.type = item.type;
    outcome.foreign = foreign;

    const canonical = canonicalise(item, deps, foreign);
    outcome.files = canonical.files.length;
    outcome.declared = canonical.declared;
    outcome.skipped = canonical.skipped;

    if (!canonical.files.some((file) => /^\/app\/(?:.+\/)?page\.tsx$/.test(file.path))) {
      throw new Error("no page to render — the item has no page, example or component file");
    }
    outcome.generatedPage = canonical.generated;

    // A registry item that imports a sibling file it does not ship cannot
    // build anywhere, so there is nothing here to test.
    if (canonical.missingSiblings.length) {
      outcome.stage = "upstream";
      outcome.reason = `the registry ships no ${canonical.missingSiblings
        .map((entry) => entry.split(" -> ")[1])
        .join(", ")}`;
      outcome.missing = canonical.missingSiblings;
      return outcome;
    }

    const project = [
      ...canonical.files,
      { path: "/app/globals.css", content: DEFAULT_STYLE_CODE },
    ];

    // `compileProjectCssCached` is the studio's own entry point: it compiles
    // the stylesheet *and* reports which vendored `ui` sources the project
    // reaches, which is exactly what the sandbox is handed.
    outcome.stage = "css";
    const cssStart = Date.now();
    const compiled = await compileProjectCssCached(project, DEFAULT_STYLE_CODE);
    outcome.cssMs = Date.now() - cssStart;
    outcome.cssBytes = compiled.css.length;

    // A stylesheet is only worth anything if it styles *this* project. Asserting
    // on a specific utility (`bg-background`) was the first attempt and it was
    // wrong: `accordion-demo` compiles 19 KB of real CSS and never writes that
    // class. So take plain classes the project's own sources write — the page
    // and the vendored `ui` files it reached, because `input-demo` is nothing
    // but `<Input />` — and require a rule for one of them.
    const plainClasses = new Set<string>();
    for (const file of [...compiled.vendored, ...project]) {
      for (const match of file.content.matchAll(/className=["']([^"']*)["']/g)) {
        for (const token of match[1].split(/\s+/)) {
          if (/^[a-z][a-z0-9-]*$/.test(token)) plainClasses.add(token);
        }
      }
    }

    const styled = [...plainClasses].filter((token) => compiled.css.includes(`.${token}`));
    if (plainClasses.size && !styled.length) {
      throw new Error(`compiled stylesheet styles none of the project's ${plainClasses.size} plain classes`);
    }

    outcome.stage = "sandbox";
    const sandboxStart = Date.now();
    const sandbox = buildSandpackProject({
      files: Object.fromEntries(
        [...compiled.vendored, ...project].map((file) => [file.path, file.content])
      ),
      compiledCss: compiled.css,
    });
    outcome.sandboxMs = Date.now() - sandboxStart;

    const paths = new Set(Object.keys(sandbox.files));
    for (const [path, content] of Object.entries(sandbox.files)) {
      for (const specifier of specifiers(content)) {
        if (/^[a-z]+:/.test(specifier)) continue;
        const bare = !specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("@/");
        if (bare) continue;
        if (!resolvesIn(specifier, path, paths)) outcome.dangling.push(`${path} -> ${specifier}`);
      }
    }

    outcome.required = collectNpmDependencies(
      Object.entries(sandbox.files)
        .filter(([path]) => !path.startsWith("/node_modules/"))
        .map(([path, content]) => ({ path, content }))
    ).filter((dependency) => !SANDBOX_PROVIDED.has(dependency));

    outcome.unpinned = outcome.required.filter(
      (dependency) => !(dependency in SANDBOX_PACKAGE_VERSIONS)
    );

    // The publish build, over the same merged file set — `withShadcnFiles`
    // already ran inside the CSS compile, and `buildComponentBundle` finds
    // `/app/page.tsx` on its own.
    outcome.stage = "build";
    const buildStart = Date.now();
    const built = await buildComponentBundle(
      [...compiled.vendored, ...project].map((file) => ({ path: file.path, content: file.content }))
    );
    outcome.buildMs = Date.now() - buildStart;
    outcome.jsBytes = built.js.length;
    outcome.externals = built.externals.filter((name) => !SANDBOX_PROVIDED.has(name));

    // A package the sandbox pins must reach the published document at the same
    // version — otherwise the two previews of one component drift apart.
    const mismatched = outcome.externals.filter((name) => {
      const version = SANDBOX_PACKAGE_VERSIONS[name];
      if (!version) return false;
      const encoded = version.replace(/^\^/, "%5E").replace(/^~/, "%7E");
      return !built.html.includes(`/${name}@${encoded}`);
    });
    if (mismatched.length) {
      throw new Error(`import map does not pin ${mismatched.join(", ")}`);
    }

    if (built.js.includes("__shadway-preview-error")) {
      throw new Error("bundle carries the preview error overlay");
    }

    // Every URL the published document will fetch, resolved for real. The
    // import map is the document's entire external surface, and a CDN that
    // cannot build a package turns a published component into a blank frame
    // that nobody here would ever see fail. `@shadcn/react` was that package:
    // esm.sh answers 500 for it ("could not resolve build entry"), which is
    // why it is installed locally and bundled instead of deferred.
    if (options.cdn) {
      outcome.cdn = await checkCdn(built.imports);
    }

    outcome.stage = "done";
    return outcome;
  } catch (error) {
    outcome.reason = error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 220) : String(error);
    return outcome;
  } finally {
    void started;
  }
}

/* ------------------------------------------------------------------ CDN -- */

/**
 * Version-pinned CDN URLs, cached for the whole run.
 *
 * A hundred chart items share `@tabler/icons-react` and the same dozen form
 * examples share `@tanstack/react-form`; re-probing each one would hammer
 * esm.sh with identical requests and earn a rate limit, so the answer for a
 * URL is fetched once and reused.
 */
const cdnStatus = new Map<string, number>();

async function probeCdn(url: string): Promise<number> {
  const cached = cdnStatus.get(url);
  if (cached !== undefined) return cached;

  let status = 0;
  try {
    const response = await fetch(url, { redirect: "follow" });
    status = response.status;
    // The body is a bundle of unbounded size and none of it is wanted; only
    // the status matters, so stop reading as soon as it arrives.
    await response.body?.cancel();
  } catch {
    status = 0;
  }

  cdnStatus.set(url, status);
  return status;
}

/**
 * Import-map URLs a CDN will not serve.
 *
 * Prefix mappings (`"react/": "https://esm.sh/react@19/"`) are skipped: they
 * exist so a deep import can be rewritten, and are not fetchable themselves.
 */
async function checkCdn(imports: Record<string, string>): Promise<{ url: string; status: number }[]> {
  const urls = [
    ...new Set(
      Object.entries(imports)
        .filter(([key]) => !key.endsWith("/"))
        .map(([, url]) => url)
    ),
  ];
  const failures: { url: string; status: number }[] = [];

  await pool(urls, 3, async (url) => {
    const status = await probeCdn(url);
    if (status !== 200) failures.push({ url, status });
  });

  return failures;
}

/* ------------------------------------------------------------------- main -- */

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };
  return {
    group: get("--group") ?? "all",
    only: get("--only")?.split(",").map((name) => name.trim()).filter(Boolean),
    limit: get("--limit") ? Number(get("--limit")) : undefined,
    concurrency: get("--concurrency") ? Number(get("--concurrency")) : 6,
    json: get("--json"),
    verbose: args.includes("--verbose"),
    cdn: args.includes("--cdn"),
  };
}

async function pool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]);
      }
    })
  );

  return results;
}

async function main() {
  const options = parseArgs();
  const response = await fetch(`${REGISTRY}/registry.json`);
  const raw = (await response.json()) as { items: IndexEntry[] };

  const order = ["registry:block", "registry:example", "registry:ui"];
  const groups: Record<string, IndexEntry[]> = {
    block: raw.items.filter((item) => item.type === "registry:block"),
    example: raw.items.filter((item) => item.type === "registry:example"),
    ui: raw.items.filter((item) => item.type === "registry:ui"),
  };

  let selected: IndexEntry[];
  if (options.only) {
    selected = options.only.map(
      (name) => raw.items.find((item) => item.name === name) ?? { name, type: "?" }
    );
  } else if (options.group === "all") {
    selected = order.flatMap((type) => raw.items.filter((item) => item.type === type));
  } else {
    selected = groups[options.group] ?? [];
  }

  if (options.limit) selected = selected.slice(0, options.limit);

  console.log(
    `auditing ${selected.length} items (${options.group}) with concurrency ${options.concurrency}\n`
  );

  const started = Date.now();
  let done = 0;
  const outcomes = await pool(selected, options.concurrency, async (entry) => {
    const outcome = await run(entry.name, options);
    done += 1;
    if (outcome.stage === "upstream") {
      console.log(`  n/a  ${String(done).padStart(4)}/${selected.length}  ${outcome.name.padEnd(28)} registry-incomplete: ${outcome.reason}`);
    } else if (outcome.stage !== "done") {
      console.log(`  FAIL ${String(done).padStart(4)}/${selected.length}  ${outcome.name.padEnd(28)} ${outcome.stage}: ${outcome.reason}`);
    } else if (options.verbose) {
      console.log(`  ok   ${String(done).padStart(4)}/${selected.length}  ${outcome.name}`);
    }
    return outcome;
  });

  const failed = outcomes.filter((outcome) => outcome.stage !== "done" && outcome.stage !== "upstream");
  const upstream = outcomes.filter((outcome) => outcome.stage === "upstream");
  const passed = outcomes.length - failed.length - upstream.length;

  console.log(`\n${"=".repeat(100)}`);
  console.log(
    `PASS ${passed}/${outcomes.length - upstream.length}` +
      (upstream.length ? `   (+ ${upstream.length} registry-incomplete, not counted)` : "") +
      `   (${((Date.now() - started) / 1000).toFixed(1)}s wall)`
  );

  if (upstream.length) {
    console.log(`\n--- registry-incomplete (the item does not ship a file it imports) ---`);
    for (const outcome of upstream) console.log(`  ${outcome.name.padEnd(30)} ${outcome.reason}`);
  }

  if (failed.length) {
    console.log(`\n--- failures by stage ---`);
    const byStage = new Map<string, Outcome[]>();
    for (const outcome of failed) {
      const list = byStage.get(outcome.stage) ?? [];
      list.push(outcome);
      byStage.set(outcome.stage, list);
    }
    for (const [stage, list] of byStage) {
      console.log(`\n[${stage}] ${list.length}`);
      for (const outcome of list) console.log(`  ${outcome.name.padEnd(30)} ${outcome.reason}`);
    }

    console.log(`\n--- failures by reason ---`);
    const byReason = new Map<string, string[]>();
    for (const outcome of failed) {
      const signature = (outcome.reason ?? "")
        .replace(/"([^"]*)"/g, '"…"')
        .replace(/\b\d+\b/g, "N");
      const list = byReason.get(signature) ?? [];
      list.push(outcome.name);
      byReason.set(signature, list);
    }
    for (const [reason, names] of [...byReason].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${names.length.toString().padStart(3)}  ${reason}`);
      if (names.length <= 8) console.log(`       ${names.join(", ")}`);
    }
  }

  const okOutcomes = outcomes.filter((outcome) => outcome.stage === "done");
  const timed = (pick: (outcome: Outcome) => number) => {
    const values = okOutcomes.map(pick).sort((a, b) => a - b);
    if (!values.length) return "-";
    return `median ${values[Math.floor(values.length / 2)]}ms  p90 ${values[Math.floor(values.length * 0.9)]}ms  max ${values.at(-1)}ms`;
  };

  console.log(
    `\n--- timing (passing items, measured under ${options.concurrency}-way concurrency) ---`
  );
  console.log(`  css     ${timed((o) => o.cssMs)}`);
  console.log(`  sandbox ${timed((o) => o.sandboxMs)}`);
  console.log(`  build   ${timed((o) => o.buildMs)}`);

  if (options.cdn) {
    const broken = new Map<string, { status: number; items: string[] }>();
    for (const outcome of outcomes) {
      for (const failure of outcome.cdn ?? []) {
        const entry = broken.get(failure.url) ?? { status: failure.status, items: [] };
        entry.items.push(outcome.name);
        broken.set(failure.url, entry);
      }
    }

    console.log(`\n--- CDN (${cdnStatus.size} URLs probed) ---`);
    if (!broken.size) {
      console.log(`  every import-map URL answered 200`);
    } else {
      for (const [url, entry] of broken) {
        console.log(`  ${String(entry.status).padEnd(4)} ${url}`);
        console.log(`       used by ${entry.items.slice(0, 6).join(", ")}${entry.items.length > 6 ? ` +${entry.items.length - 6}` : ""}`);
      }
      console.log(`  a package the CDN will not serve has to be installed here instead`);
    }
  }

  const unpinned = new Map<string, number>();
  const externals = new Map<string, number>();
  const danglingNames = new Set<string>();
  for (const outcome of outcomes) {
    for (const name of outcome.unpinned) unpinned.set(name, (unpinned.get(name) ?? 0) + 1);
    for (const name of outcome.externals) externals.set(name, (externals.get(name) ?? 0) + 1);
    for (const item of outcome.dangling) danglingNames.add(item);
  }

  if (unpinned.size) {
    console.log(`\n--- packages the sandbox installs at \`latest\` ---`);
    for (const [name, count] of [...unpinned].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count.toString().padStart(4)}  ${name}`);
    }
  }

  if (externals.size) {
    console.log(`\n--- packages served from a CDN in the published build ---`);
    for (const [name, count] of [...externals].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count.toString().padStart(4)}  ${name}`);
    }
  }

  if (danglingNames.size) {
    console.log(`\n--- dangling specifiers (sandbox) ---`);
    for (const item of [...danglingNames].sort().slice(0, 40)) console.log(`  ${item}`);
  }

  if (options.json) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(options.json, JSON.stringify(outcomes, null, 2), "utf8");
    console.log(`\nwrote ${options.json}`);
  }

  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
