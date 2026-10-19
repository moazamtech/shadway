import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentDocument } from "@/lib/db/components";
// The vendored shadcn/ui data — facts about the upstream registry, not a
// constant the builder is allowed to define. The contract below asks "could the
// CLI resolve this name?", and this is how that question is answered.
import { hasShadcnFile } from "@/lib/preview/shadcn-ui";

/**
 * The registry-item contract.
 *
 * `GET /r/<slug>` serves one document, and `npx shadcn add http://<host>/r/<slug>`
 * installs exactly what that document says. Nothing in the app validates the
 * document against the schema it advertises in `$schema`, so a field that is
 * merely *wrong* — `"type": "registry:hero"`, a registry dependency the CLI
 * cannot fetch — ships, builds, serves, and is only discovered when somebody
 * tries to install it. That is how one of those shipped for months.
 *
 * So this file is the check. It is hand-written on purpose: no validator
 * dependency, no schema import, and — critically — **not** an import of the
 * constants the source uses to build the item. The two lists below are
 * transcribed by hand from the published schema, so if the source and the
 * schema ever drift apart again, this file fails rather than agreeing with the
 * bug. That is the whole point: an oracle that shares its implementation with
 * the thing it audits is not an oracle.
 */

/* ------------------------------------------------------------------------ *
 * The contract, transcribed from https://ui.shadcn.com/schema/registry-item.json
 *
 * Read 2026-10-19. Re-read it and update this block if it disagrees with
 * anything below; that is the only time these lists should move.
 *
 * Cross-checked against the same schema's runtime form in the CLI this repo
 * actually installs (`node_modules/shadcn/dist/schema/index.d.ts`, shadcn
 * ^3.5.0, `registryItemTypeSchema`). The CLI's enum is a strict superset of the
 * published one — it additionally accepts `registry:example` and
 * `registry:internal` — so satisfying the published schema is what keeps the
 * item valid for every consumer, including one that validates against the
 * `$schema` we declare.
 * ------------------------------------------------------------------------ */

/** `properties.$schema` is not in the schema, but every published item has it. */
const REGISTRY_ITEM_SCHEMA_URL = "https://ui.shadcn.com/schema/registry-item.json";

/** `properties.type.enum`. */
const REGISTRY_ITEM_TYPES = [
  "registry:lib",
  "registry:block",
  "registry:component",
  "registry:ui",
  "registry:hook",
  "registry:theme",
  "registry:page",
  "registry:file",
  "registry:style",
  "registry:base",
  "registry:font",
  "registry:item",
] as const;

/** `properties.files.items.properties.type.enum` — the same set minus `registry:font`. */
const REGISTRY_FILE_TYPES = REGISTRY_ITEM_TYPES.filter(
  (type) => type !== "registry:font"
) as readonly (typeof REGISTRY_ITEM_TYPES)[number][];

/** Top-level `required`. */
const REGISTRY_ITEM_REQUIRED = ["name", "type"] as const;

/**
 * `properties.files.items` is a conditional: `else` requires `path` and `type`,
 * and `if type is registry:file | registry:page` then `path`, `type` *and*
 * `target` are required.
 */
const REGISTRY_FILE_REQUIRED = ["path", "type"] as const;
const REGISTRY_FILE_TYPES_REQUIRING_TARGET = ["registry:file", "registry:page"] as const;

/** `properties.dependencies.items.type === "string"`. */
const NPM_UNSCOPED_NAME = /^[a-z0-9][a-z0-9._-]*$/i;
const NPM_SCOPED_NAME = /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i;

/** Already present in the project running `shadcn add`; declaring them is noise. */
const HOST_PACKAGES = new Set(["react", "react-dom", "next"]);

/** A registry reference resolved from the project's `components.json`. */
const NAMED_REGISTRY_REFERENCE = /^@[a-zA-Z0-9][a-zA-Z0-9-_]*\/[a-zA-Z0-9][a-zA-Z0-9-_]*$/;

const ABSOLUTE_URL = /^https?:\/\/[^\s]+$/;

/** An item name — `button`, `data-table` — resolved against a registry. */
const BARE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* ------------------------------------------------------------------ *
 * The standalone oracle.
 * ------------------------------------------------------------------ */

/**
 * Collects every way `item` breaks the contract, so one failing assertion
 * reports all of them instead of only the first.
 */
function contractViolations(item: unknown, options: { slug?: string } = {}): string[] {
  const bad: string[] = [];
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return ["item is not an object"];
  }
  const record = item as Record<string, unknown>;

  if (record.$schema !== REGISTRY_ITEM_SCHEMA_URL) {
    bad.push(`$schema is ${JSON.stringify(record.$schema)}`);
  }

  for (const field of REGISTRY_ITEM_REQUIRED) {
    if (typeof record[field] !== "string" || !record[field]) {
      bad.push(`required field ${field} is ${JSON.stringify(record[field])}`);
    }
  }

  const name = record.name;
  if (typeof name === "string" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    bad.push(`name ${JSON.stringify(name)} is not URL-safe`);
  }
  if (options.slug !== undefined && name !== options.slug) {
    bad.push(`name ${JSON.stringify(name)} does not match the slug ${JSON.stringify(options.slug)}`);
  }

  if (!REGISTRY_ITEM_TYPES.includes(record.type as never)) {
    bad.push(`type ${JSON.stringify(record.type)} is not a type the CLI accepts`);
  }

  for (const field of ["title", "description"]) {
    if (record[field] !== undefined && typeof record[field] !== "string") {
      bad.push(`${field} is ${JSON.stringify(record[field])}, not a string`);
    }
  }

  if (!Array.isArray(record.files) || record.files.length === 0) {
    bad.push("files is not a non-empty array");
  } else {
    const seen = new Set<string>();
    record.files.forEach((raw, index) => {
      const where = `files[${index}]`;
      if (!raw || typeof raw !== "object") {
        bad.push(`${where} is not an object`);
        return;
      }
      const file = raw as Record<string, unknown>;

      for (const field of REGISTRY_FILE_REQUIRED) {
        if (typeof file[field] !== "string" || !file[field]) {
          bad.push(`${where} has no ${field}`);
        }
      }
      // Not required by the schema, but a file with no content writes an empty
      // file and reports success — the install looks like it worked.
      if (typeof file.content !== "string" || file.content.length === 0) {
        bad.push(`${where} has no content`);
      }
      if (typeof file.path === "string" && file.path) {
        if (!isProjectRelative(file.path)) {
          bad.push(`${where} path ${JSON.stringify(file.path)} is not a project-relative path`);
        }
        if (seen.has(file.path)) {
          bad.push(`${where} repeats the path ${JSON.stringify(file.path)}`);
        }
        seen.add(file.path);
      }
      if (typeof file.type === "string" && !REGISTRY_FILE_TYPES.includes(file.type as never)) {
        bad.push(`${where} type ${JSON.stringify(file.type)} is not a type the CLI accepts`);
      }
      if (
        typeof file.type === "string" &&
        REGISTRY_FILE_TYPES_REQUIRING_TARGET.includes(file.type as never) &&
        !(typeof file.target === "string" && file.target)
      ) {
        bad.push(`${where} is a ${file.type}, which requires a target`);
      }
    });
  }

  if (record.dependencies !== undefined && !Array.isArray(record.dependencies)) {
    bad.push("dependencies is not an array");
  }
  for (const dep of (record.dependencies ?? []) as unknown[]) {
    if (typeof dep !== "string") {
      bad.push(`dependency ${JSON.stringify(dep)} is not a string`);
      continue;
    }
    if (!NPM_UNSCOPED_NAME.test(dep) && !NPM_SCOPED_NAME.test(dep)) {
      bad.push(`dependency ${JSON.stringify(dep)} is not an npm package name`);
    }
    if (HOST_PACKAGES.has(dep)) {
      bad.push(`dependency ${JSON.stringify(dep)} is the host project's own package`);
    }
  }

  if (record.registryDependencies !== undefined && !Array.isArray(record.registryDependencies)) {
    bad.push("registryDependencies is not an array");
  }
  for (const dep of (record.registryDependencies ?? []) as unknown[]) {
    if (typeof dep !== "string") {
      bad.push(`registryDependency ${JSON.stringify(dep)} is not a string`);
      continue;
    }
    // The CLI decides URL-vs-name with `new URL()`. A relative path fails that,
    // so it is looked up as an item name in the default shadcn/ui registry
    // instead — where nothing of ours lives, and the install dies there.
    //
    // A bare name is a different case, and the reason this check is not simply
    // "must be absolute": shadcn's own items declare each other that way
    // (`sidebar` lists `button`, `separator`, `sheet`), and the CLI resolves
    // them against the default registry. So a bare name is legal *when the file
    // it addresses is one shadcn publishes* — the only shape that can be
    // resolved — and still a violation for a shadway slug, which cannot.
    const isUpstreamPrimitive =
      BARE_NAME.test(dep) && hasShadcnFile(`ui/${dep.replace(/\.tsx$/, "")}.tsx`);
    if (
      !ABSOLUTE_URL.test(dep) &&
      !NAMED_REGISTRY_REFERENCE.test(dep) &&
      !isUpstreamPrimitive
    ) {
      bad.push(
        `registryDependency ${JSON.stringify(dep)} is neither an absolute URL, an @registry/name reference, nor a primitive shadcn publishes`
      );
    }
  }

  return bad;
}

function isProjectRelative(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("/") || value.includes("\\") || value.includes("\0")) return false;
  return value.split("/").every((segment) => segment && segment !== "." && segment !== "..");
}

/* ------------------------------------------------------------------ *
 * The store `buildRegistryItem` and the resolver read from.
 * ------------------------------------------------------------------ */

const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }));

/**
 * Honours whichever fields the filter actually constrains, the way the real
 * queries do: `getComponentBySlug` filters on `status` only and leaves the
 * visibility check to its caller, `resolveRegistryDependencies` filters on both.
 */
function matchesFilter(doc: unknown, filter: Record<string, unknown> | undefined): boolean {
  if (!doc || !filter) return false;
  const record = doc as Record<string, unknown>;
  return Object.entries(filter).every(
    ([field, value]) => value === undefined || record[field] === value
  );
}

vi.mock("@/lib/db/components", () => ({
  getComponentBySlug: vi.fn(async (slug: string) =>
    matchesFilter(store.get(slug), { slug, status: "published" })
      ? store.get(slug)
      : null
  ),
  getComponentsCollection: vi.fn(async () => ({
    findOne: async (filter: { slug?: unknown }) => {
      const doc =
        typeof filter?.slug === "string" ? store.get(filter.slug) : undefined;
      return matchesFilter(doc, filter as Record<string, unknown>) ? doc : null;
    },
  })),
}));

const { buildRegistryItem } = await import("@/lib/registry");

const ORIGIN = "https://shadway.example";

/** What a real published component's `code` looks like. */
const HERO_CODE = `"use client";

import * as React from "react";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CheckoutSheet } from "~/components/checkout-sheet";

export function PricingHero({ title }: { title: string }) {
  return (
    <motion.section className={cn("py-24", title)}>
      <ArrowRight />
      <CheckoutSheet />
    </motion.section>
  );
}
`;

const DEMO_CODE = `import { PricingHero } from "./pricing-hero";

export default function Demo() {
  return <PricingHero title="Pricing" />;
}
`;

const HERO_CSS = `:root {
  --pricing-accent: oklch(0.72 0.17 250);
}

.dark {
  --pricing-accent: oklch(0.62 0.17 250);
}
`;

function document(overrides: Partial<ComponentDocument> = {}): ComponentDocument {
  return {
    slug: "pricing-hero",
    name: "pricing-hero",
    title: "Pricing Hero",
    description: "A pricing section with a gradient background.",
    code: HERO_CODE,
    files: [
      {
        path: "/components/pricing/pricing-hero-demo.tsx",
        content: DEMO_CODE,
        type: "registry:component",
      },
      {
        path: "styles/pricing-hero.css",
        content: HERO_CSS,
        type: "registry:style",
      },
    ],
    category: "ui",
    tags: ["pricing-section", "hero"],
    // As an author would declare them, including the two the studio's import
    // walk would never produce: the host's own `next`, and a path alias.
    dependencies: ["motion", "lucide-react", "next", "@/lib/utils", "./local-helper"],
    devDependencies: [],
    registryDependencies: ["button", "acme/other-block", "https://example.com/r/third-party.json"],
    author: { userId: "u_ada", name: "Ada Lovelace", username: "ada" },
    visibility: "public",
    status: "published",
    installs: 12,
    views: 400,
    likes: 30,
    featured: false,
    version: "1.2.0",
    license: "MIT",
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedAt: new Date("2026-02-02T00:00:00.000Z"),
    publishedAt: new Date("2026-02-02T00:00:00.000Z"),
    ...overrides,
  };
}

/** A component pulled in by `registryDependencies`, with its own messy data. */
function dependencyDocument(overrides: Partial<ComponentDocument> = {}): ComponentDocument {
  return document({
    slug: "button",
    name: "button",
    title: "Button",
    code: `import { Slot } from "@radix-ui/react-slot";\n\nexport function Button() {\n  return <Slot />;\n}\n`,
    files: [
      {
        path: "components/ui/button.tsx",
        content: `export function ButtonVariants() { return null; }\n`,
        type: "registry:ui",
      },
    ],
    category: "ui",
    tags: ["button"],
    dependencies: ["@radix-ui/react-slot", "class-variance-authority", "react-dom", "~/lib/cn"],
    registryDependencies: [],
    ...overrides,
  });
}

beforeEach(() => {
  store.clear();
  store.set("pricing-hero", document());
  store.set("button", dependencyDocument());
});

async function build(slug = "pricing-hero", options: { origin?: string } = { origin: ORIGIN }) {
  return buildRegistryItem({ slug }, options);
}

/* ------------------------------------------------------------------ */

describe("buildRegistryItem — the shadcn registry-item contract", () => {
  it("builds an item the CLI can install", async () => {
    const item = await build();

    expect(item).not.toBeNull();
    expect(contractViolations(item, { slug: "pricing-hero" })).toEqual([]);
  });

  it("declares the schema it is held to", async () => {
    const item = await build();
    expect(item?.$schema).toBe("https://ui.shadcn.com/schema/registry-item.json");
  });

  it("names the item after its slug, and the slug is URL-safe", async () => {
    const item = await build();
    expect(item?.name).toBe("pricing-hero");
    expect(item?.name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

    // A name the URL cannot carry is an item nobody can address.
    store.set("Not A Slug", document({ slug: "Not A Slug", name: "Not A Slug" }));
    expect(await build("Not A Slug")).toBeNull();
  });

  it("gives every file a path, content and an accepted type", async () => {
    const item = await build();

    expect(item?.files.length).toBeGreaterThan(0);
    for (const file of item?.files ?? []) {
      expect(typeof file.path).toBe("string");
      expect(file.path).not.toBe("");
      expect(file.content.length).toBeGreaterThan(0);
      expect(REGISTRY_FILE_TYPES).toContain(file.type);
    }
  });

  /**
   * `files[].type` is free text on the document — `PUT /api/components/[slug]`
   * stores `body.files[].type` verbatim, defaulting to `registry:file` — and it
   * was passed straight through to the item. A component saved with
   * `"registry:hero"`, or with `"registry:file"` and no target, made the whole
   * item unparseable.
   */
  it("normalises a stored file type the CLI does not accept", async () => {
    store.set(
      "pricing-hero",
      document({
        files: [
          { path: "components/pricing/hero-demo.tsx", content: DEMO_CODE, type: "registry:hero" },
          { path: "components/pricing/hero.tsx", content: "export const x = 1;\n", type: "component" },
        ],
      })
    );

    const item = await build();
    expect(contractViolations(item, { slug: "pricing-hero" })).toEqual([]);
  });

  /**
   * The CLI only writes a file at its declared path when it is given a
   * `target`; without one it takes the directory from `type` and the filename
   * from `path`, flattening everything in between. That is not a cosmetic
   * difference: `components/pricing/hero.tsx` and `components/pricing/hero-demo.tsx`
   * both land directly in `components/`, and a two-file component overwrites
   * itself. Measured against `shadcn@3.8.5`.
   */
  it("gives every file the target that keeps its directory", async () => {
    store.set(
      "pricing-hero",
      document({
        files: [
          { path: "components/pricing/hero-demo.tsx", content: DEMO_CODE, type: "registry:file" },
          {
            path: "app/pricing/page.tsx",
            content: "export default function Page() { return null; }\n",
            type: "registry:page",
          },
          { path: "components/pricing/nested/panel.tsx", content: "export const p = 1;\n", type: "registry:component" },
          { path: "styles/pricing-hero.css", content: HERO_CSS, type: "registry:style" },
        ],
      })
    );

    const item = await build();
    expect(contractViolations(item, { slug: "pricing-hero" })).toEqual([]);

    for (const file of item?.files ?? []) {
      expect(file.target, file.path).toBe(file.path);
    }

    // The source file is the one case whose path is decided by the item, and it
    // belongs in the UI directory for a UI item.
    expect(item?.files[0].path).toBe("components/ui/pricing-hero.tsx");
    expect(item?.files[0].type).toBe("registry:ui");
  });

  it("puts a block's source where blocks live", async () => {
    store.set(
      "pricing-hero",
      document({ category: "marketing", files: [] })
    );

    const item = await build();
    expect(item?.type).toBe("registry:block");
    expect(item?.files[0].path).toBe("components/pricing-hero.tsx");
    expect(item?.files[0].target).toBe("components/pricing-hero.tsx");
    expect(item?.files[0].type).toBe("registry:block");
  });

  /**
   * The studio builds every component at `components/component.tsx`, so its
   * supporting files are siblings of that path and the source imports them
   * relatively (`./panel`). A UI item installs at `components/ui/<slug>.tsx`;
   * leaving `panel.tsx` at `components/panel.tsx` makes that import point at a
   * module the CLI never wrote, and the install still exits 0.
   *
   * Measured against `shadcn@3.8.5` in `scripts/qa-install.ts`: before this, a
   * two-file component installed cleanly into a scratch project and could not
   * be imported. The whole author directory moves by the same delta as the
   * source, so every relative edge survives untouched.
   */
  it("moves a UI item's supporting files with its source", async () => {
    store.set(
      "pricing-hero",
      document({
        componentPath: "/components/component.tsx",
        files: [
          { path: "components/panel.tsx", content: "export const p = 1;\n", type: "registry:component" },
          { path: "components/deep/stat.tsx", content: "export const s = 1;\n", type: "registry:component" },
          { path: "lib/shared.ts", content: "export const x = 1;\n", type: "registry:lib" },
        ],
      })
    );

    const item = await build();
    const paths = (item?.files ?? []).map((file) => file.path);

    expect(paths).toContain("components/ui/pricing-hero.tsx");
    expect(paths).toContain("components/ui/panel.tsx");
    expect(paths).toContain("components/ui/deep/stat.tsx");
    // Not a neighbour of the source, so it is not the source's to move.
    expect(paths).toContain("lib/shared.ts");
    for (const file of item?.files ?? []) expect(file.target, file.path).toBe(file.path);
  });

  it("drops a file path that would be written outside the project", async () => {
    store.set(
      "pricing-hero",
      document({
        files: [
          { path: "../../../../.ssh/authorized_keys", content: "ssh-rsa AAAA\n", type: "registry:file" },
          { path: "C:/Users/ada/.ssh/id_ed25519", content: "key\n", type: "registry:file" },
          { path: "styles/pricing-hero.css", content: HERO_CSS, type: "registry:style" },
        ],
      })
    );

    const item = await build();
    expect(contractViolations(item, { slug: "pricing-hero" })).toEqual([]);
    expect(item?.files.some((file) => file.path.includes(".."))).toBe(false);
    expect(item?.files.some((file) => /^[a-zA-Z]:/.test(file.path))).toBe(false);
    expect(item?.files.every((file) => file.target === file.path)).toBe(true);
  });

  it("keeps only one file per path", async () => {
    store.set(
      "pricing-hero",
      document({
        files: [
          { path: "components/ui/pricing-hero.tsx", content: "export const shadow = 1;\n", type: "registry:component" },
          { path: "styles/pricing-hero.css", content: HERO_CSS, type: "registry:style" },
        ],
      })
    );

    const item = await build();
    const paths = (item?.files ?? []).map((file) => file.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  /**
   * `dependencies` is what the CLI writes into the consumer's `package.json`.
   * A path alias in it is not a package: npm fails, the install fails, and the
   * CLI reports a broken component rather than a bad manifest. This is the
   * defect that put a package named `~` in somebody's project.
   */
  it("names only real npm packages in dependencies", async () => {
    const item = await build();

    expect(item?.dependencies).not.toContain("react");
    expect(item?.dependencies).not.toContain("react-dom");
    expect(item?.dependencies).not.toContain("next");
    expect(item?.dependencies).not.toContain("@/lib/utils");
    expect(item?.dependencies).not.toContain("~/lib/cn");
    expect(item?.dependencies).not.toContain("./local-helper");

    expect(contractViolations(item, { slug: "pricing-hero" })).toEqual([]);
  });

  it("carries the packages the installed code imports, including the tree's", async () => {
    const item = await build();

    // Read out of the component's own source.
    expect(item?.dependencies).toContain("motion");
    expect(item?.dependencies).toContain("lucide-react");
    // Read out of the component it pulls in.
    expect(item?.dependencies).toContain("@radix-ui/react-slot");
    expect(item?.dependencies).toContain("class-variance-authority");
  });

  it("keeps a declared package the import walk cannot see", async () => {
    store.set(
      "pricing-hero",
      document({
        code: "export const PricingHero = () => null;\n",
        files: [],
        dependencies: ["zod"],
      })
    );

    const item = await build();
    expect(item?.dependencies).toContain("zod");
  });

  /**
   * The CLI resolves a dependency that is not an absolute URL and not an
   * `@registry/name` reference by name, against the default shadcn/ui
   * registry — where shadway does not exist. A relative `/r/button` fails its
   * `new URL()` check and lands there too, so the rewrite has to be absolute.
   */
  it("points every registry dependency at something the CLI can fetch", async () => {
    const item = await build();

    expect(item?.registryDependencies).toContain(`${ORIGIN}/r/button`);
    expect(item?.registryDependencies).toContain(`${ORIGIN}/r/acme/other-block`);
    expect(item?.registryDependencies).toContain("https://example.com/r/third-party.json");

    // An `@registry/name` entry belongs to the consumer's components.json. The
    // CLI throws on one it cannot resolve, so rewriting it would be worse than
    // leaving it alone.
    store.set(
      "pricing-hero",
      document({ registryDependencies: ["@acme/button"] })
    );
    expect((await build())?.registryDependencies).toEqual(["@acme/button"]);
  });

  it("drops a dependency it cannot make absolute rather than shipping it broken", async () => {
    const item = await build("pricing-hero", { origin: "" });

    expect(contractViolations(item, { slug: "pricing-hero" })).toEqual([]);
    for (const dep of item?.registryDependencies ?? []) {
      expect(dep.startsWith("/"), dep).toBe(false);
    }
  });

  /**
   * The route serves `NextResponse.json(item)`, so `undefined`, `Date` and
   * friends are whatever `JSON.stringify` makes of them. The contract is on the
   * bytes on the wire.
   */
  /**
   * The install-breaking omission.
   *
   * A published component whose code imports `@/components/ui/dialog` installed
   * into a project without `dialog.tsx`: the item's `files` held only the
   * author's source and its `dependencies` held Radix — because the publish route
   * expands the UI files to detect npm packages, so the item *looked* complete —
   * and the consumer's build failed on a module nobody ever mentioned.
   */
  it("names the components/ui primitives the installed code imports", async () => {
    store.set(
      "pricing-hero",
      document({
        code: `import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

export function PricingHero() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open</Button>
      </DialogTrigger>
      <DialogContent>Hello</DialogContent>
    </Dialog>
  );
}
`,
        files: [],
        dependencies: [],
        registryDependencies: [],
      })
    );

    const item = await build();

    expect(item?.registryDependencies).toContain("button");
    expect(item?.registryDependencies).toContain("dialog");
    // The names are item names, not file names: `dialog.tsx` resolves against
    // shadcn's registry as a file that does not exist.
    expect(item?.registryDependencies).not.toContain("dialog.tsx");

    // The npm packages reached through those files come along, or the consumer
    // installs a dialog without the Radix package it renders.
    expect(item?.dependencies).toContain("@radix-ui/react-dialog");
    expect(item?.dependencies).toContain("@radix-ui/react-slot");

    expect(contractViolations(item, { slug: "pricing-hero" })).toEqual([]);
  });

  it("does not redeclare a primitive the item already ships", async () => {
    // An author who writes their own `components/ui/button.tsx` keeps it, and the
    // CLI must not fetch shadcn's over the top of it.
    store.set(
      "pricing-hero",
      document({
        code: `import { Button } from "@/components/ui/button";\n\nexport function PricingHero() {\n  return <Button />;\n}\n`,
        files: [
          {
            path: "components/ui/button.tsx",
            content: "export function Button() { return null; }\n",
            type: "registry:ui",
          },
        ],
        dependencies: [],
        registryDependencies: [],
      })
    );

    const item = await build();

    expect(item?.registryDependencies).not.toContain("button");
    expect(item?.files.map((file) => file.path)).toContain("components/ui/button.tsx");
  });

  it("does not invent a bare name for a file shadcn does not publish", async () => {
    // A bare name is looked up in the default registry. One we cannot vouch for
    // installs somebody else's component, or 404s — either way it is worse than
    // saying nothing.
    store.set(
      "pricing-hero",
      document({
        code: `import { Thing } from "@/components/ui/not-a-real-primitive";\n\nexport function PricingHero() {\n  return <Thing />;\n}\n`,
        files: [],
        dependencies: [],
        registryDependencies: [],
      })
    );

    const item = await build();

    expect(item?.registryDependencies).toEqual([]);
    expect(contractViolations(item, { slug: "pricing-hero" })).toEqual([]);
  });

  it("survives the JSON round trip the route serves", async () => {
    const item = await build();
    const onTheWire = JSON.parse(JSON.stringify(item));

    expect(contractViolations(onTheWire, { slug: "pricing-hero" })).toEqual([]);
    expect(onTheWire).toEqual(item);
  });

  it("emits cssVars only when there are some, and only in the documented shape", async () => {
    // Nothing declares a custom property, so there is nothing to merge.
    store.set("pricing-hero", document({ files: [], cssVars: undefined }));
    const plain = await build();
    expect(plain?.cssVars).toBeUndefined();

    // The component's *own* stylesheet. These used to be dropped: the vars
    // were read for the dependency tree and never for the component being
    // installed, so a component whose styling depended on its own custom
    // properties shipped with none of them.
    store.set(
      "pricing-hero",
      document({ files: [{ path: "styles/a.css", content: HERO_CSS, type: "registry:style" }] })
    );
    expect((await build())?.cssVars).toEqual({
      light: { "--pricing-accent": "oklch(0.72 0.17 250)" },
      dark: { "--pricing-accent": "oklch(0.62 0.17 250)" },
    });

    // And the studio's already-parsed `cssVars`, for a component with no CSS file.
    store.set(
      "pricing-hero",
      document({
        files: [],
        cssVars: { light: { "--brand": "#fff" }, dark: { "--brand": "#000" } },
      })
    );
    expect((await build())?.cssVars).toEqual({
      light: { "--brand": "#fff" },
      dark: { "--brand": "#000" },
    });
  });

  /** The tree's variables and the component's own, merged. */
  it("merges the tree's cssVars with the component's own", async () => {
    store.set(
      "pricing-hero",
      document({ files: [{ path: "styles/a.css", content: HERO_CSS, type: "registry:style" }] })
    );
    store.set(
      "button",
      dependencyDocument({
        files: [
          {
            path: "components/ui/button.tsx",
            content: `export function ButtonVariants() { return null; }\n`,
            type: "registry:ui",
          },
          {
            path: "styles/button.css",
            content: `:root { --button-bg: white; }\n.dark { --button-bg: black; }\n`,
            type: "registry:style",
          },
        ],
      })
    );

    const item = await build();
    expect(item?.cssVars).toEqual({
      light: { "--pricing-accent": "oklch(0.72 0.17 250)", "--button-bg": "white" },
      dark: { "--pricing-accent": "oklch(0.62 0.17 250)", "--button-bg": "black" },
    });
  });
});

/**
 * Every value the database was filed under before the taxonomy landed. Each one
 * used to reach the item as `registry:<category>`; `hero` shipped as
 * `"type": "registry:hero"` — not a type the CLI accepts — and the only way to
 * find out was to run `shadcn add` and watch it fail.
 */
describe("a component filed under a legacy category", () => {
  for (const category of [
    "hero",
    "block",
    "marketing",
    "animation",
    "form",
    "data",
    "general",
  ]) {
    it(`still produces a valid type for "${category}"`, async () => {
      store.set("pricing-hero", document({ category }));

      const item = await build();
      expect(REGISTRY_ITEM_TYPES, `${category} -> ${item?.type}`).toContain(item?.type as never);
      expect(contractViolations(item, { slug: "pricing-hero" })).toEqual([]);
    });
  }

  it("produces a valid type for a category nobody has ever used", async () => {
    store.set("pricing-hero", document({ category: "something-new" }));

    const item = await build();
    expect(REGISTRY_ITEM_TYPES).toContain(item?.type as never);
    expect(contractViolations(item, { slug: "pricing-hero" })).toEqual([]);
  });

  /**
   * The values `shadcnRegistrySlug` still names directly. `registry:example` is
   * the trap in this list: the CLI's runtime schema accepts it, the published
   * schema this item advertises in `$schema` does not list it, so an item
   * declaring it is invalid by the contract it claims to satisfy.
   */
  it("produces a valid type for every category the mapper names directly", async () => {
    for (const category of [
      "hooks",
      "blocks",
      "icons",
      "lib",
      "utils",
      "example",
      "examples",
      "",
    ]) {
      store.set("pricing-hero", document({ category: category || "ui" }));

      const item = await build();
      expect(REGISTRY_ITEM_TYPES, `${category} -> ${item?.type}`).toContain(item?.type as never);
      expect(contractViolations(item, { slug: "pricing-hero" })).toEqual([]);
    }
  });
});

describe("a component that cannot be served", () => {
  it("returns null rather than an item nobody can install", async () => {
    store.set("pricing-hero", document({ status: "draft" }));
    expect(await build()).toBeNull();

    store.set("pricing-hero", document({ visibility: "unlisted" }));
    expect(await build()).toBeNull();

    store.clear();
    expect(await build()).toBeNull();
  });
});