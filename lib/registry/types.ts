import { packageNameForSpecifier } from "@/lib/studio/deps";

/**
 * The shadcn registry-item contract, in one place.
 *
 * ## Why this file exists
 *
 * Every field in the item `GET /r/<slug>` serves is load-bearing, and until
 * nothing checked them against the schema the item advertises in `$schema`,
 * "load-bearing" only meant "something breaks later, in somebody else's
 * project". The costs were real and each one had already been paid:
 *
 * - a component filed under `hero` shipped `"type": "registry:hero"`, a type
 *   the CLI does not accept;
 * - `files[].type` is stored verbatim from the request body, so an older client
 *   could store `component`, `registry:hero`, or a bare `page` and the whole
 *   item became unparseable;
 * - a `registry:file` or `registry:page` without a `target` is rejected by the
 *   schema outright, and nothing has ever persisted a target;
 * - declared dependencies were never filtered, so `~/lib/utils` became an npm
 *   install of a package named `~`;
 * - `registryDependencies` were rewritten against an origin nobody passed, so
 *   they shipped as `/r/button` — which the CLI resolves as a *name* in the
 *   default shadcn/ui registry, where shadway does not exist.
 *
 * Each of those is now impossible to express from here, rather than checked
 * for somewhere downstream.
 */

/**
 * The schema this item is validated against. Written into `$schema` on every
 * item, so it is not decoration: a consumer that resolves `$schema` and
 * validates will use exactly these rules.
 */
export const REGISTRY_ITEM_SCHEMA_URL = "https://ui.shadcn.com/schema/registry-item.json";

/**
 * `properties.type.enum`, read from https://ui.shadcn.com/schema/registry-item.json
 * on 2026-10-19.
 *
 * The shadcn CLI's own runtime schema accepts two more — `registry:example`
 * and `registry:internal` — so this list is the *narrower* of the two on
 * purpose: anything valid here is valid for the CLI, and valid for anything
 * that validates against the `$schema` we declare. `registry:example` in
 * particular is a legacy type the published schema no longer lists, so an item
 * declaring it is invalid by the contract it claims to satisfy.
 */
export const REGISTRY_ITEM_TYPES = [
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

export type RegistryItemType = (typeof REGISTRY_ITEM_TYPES)[number];

/**
 * `properties.files.items.properties.type.enum` — the item's set minus
 * `registry:font`, which is an item type, not a file type.
 */
export const REGISTRY_FILE_TYPES = [
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
  "registry:item",
] as const;

export type RegistryFileType = (typeof REGISTRY_FILE_TYPES)[number];

/**
 * The conditional on each file: these two types additionally require `target`,
 * because the CLI writes them verbatim rather than deriving a destination from
 * the type. Every file carries one now (see `toRegistryFile`), so this is only
 * useful as documentation of the schema.
 */
const ITEM_TYPES = new Set<string>(REGISTRY_ITEM_TYPES);
const FILE_TYPES = new Set<string>(REGISTRY_FILE_TYPES);

export function isRegistryItemType(value: unknown): value is RegistryItemType {
  return typeof value === "string" && ITEM_TYPES.has(value);
}

export function isRegistryFileType(value: unknown): value is RegistryFileType {
  return typeof value === "string" && FILE_TYPES.has(value);
}

/** What `buildRegistryItem` falls back to when nothing better is known. */
const DEFAULT_FILE_TYPE: RegistryFileType = "registry:component";

/**
 * Packages the project running `shadcn add` already has.
 *
 * They come out of the import walk, but must not go into `dependencies`: the
 * CLI runs inside a React project, and every item declaring the framework it
 * is being installed into is noise at best.
 */
const HOST_PACKAGES = new Set(["react", "react-dom", "next"]);

const ABSOLUTE_URL = /^https?:\/\/\S+$/i;

/** A reference the consumer resolves from the `registries` map in components.json. */
const NAMED_REGISTRY_REFERENCE = /^@[a-zA-Z0-9][a-zA-Z0-9-_]*\/[a-zA-Z0-9][a-zA-Z0-9-_]*$/;

/**
 * The item name has to survive a URL: it is `/r/<name>`, and the CLI uses it
 * to key what it has already installed.
 *
 * This is the same pattern `SLUG_PATTERN` in `lib/component-slug.ts` holds, and
 * deliberately a *separate* rule rather than a call to its `isValidSlug`. That
 * one also bounds length at 3..80, which is a rule about what may be *chosen*
 * when a component is published; this one is about what may be *served* now.
 * A document minted under the old rules can have a name this module accepts
 * and `isValidSlug` refuses, and refusing to serve it would be a change of
 * behaviour wearing the costume of a validation fix.
 */
const REGISTRY_ITEM_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isRegistryItemName(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && REGISTRY_ITEM_NAME.test(value);
}

/**
 * A path relative to the consumer's project root, with no traversal.
 *
 * The CLI joins this onto the project directory and writes it, so a stored
 * `../../../../.ssh/authorized_keys` is a file written outside the project
 * under the authority of whoever runs `shadcn add`. Leading slashes have
 * always been stripped; `..` never was.
 */
export function normalizeRegistryFilePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim().replace(/^\/+/, "");
  if (!path) return null;
  if (path.includes("\\") || path.includes("\0")) return null;
  // `C:/Users/...` survives the leading-slash strip and is absolute on Windows.
  if (/^[a-zA-Z]:/.test(path)) return null;
  const segments = path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
  return path;
}

/**
 * The type a file may carry.
 *
 * Anything the schema does not list becomes `registry:component`, which is
 * where a component's source belongs anyway — and it is strictly better than
 * the alternative, which is an item the CLI refuses to parse at all.
 */
export function normalizeRegistryFileType(value: unknown): RegistryFileType {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (isRegistryFileType(trimmed)) return trimmed;
    // Older clients stored the bare word ("component", "file", "ui").
    const prefixed = `registry:${trimmed.replace(/^registry:/, "")}`;
    if (isRegistryFileType(prefixed)) return prefixed;
  }
  return DEFAULT_FILE_TYPE;
}

export type RegistryFile = {
  path: string;
  content: string;
  type: RegistryFileType;
  target?: string;
};

/**
 * A file the CLI can write, or `null` when there is nothing worth writing.
 *
 * `target` is always written, not only for the two types the schema requires it
 * on. The reason is a bug that only shows up in somebody else's project: the
 * CLI, given no `target`, derives the destination *directory from the type and
 * the filename from the path*, discarding every directory in between. An item
 * whose type is `registry:component` — the default this module assigns — has
 * `components/ui/pricing-hero.tsx` written to `components/pricing-hero.tsx`, and
 * `components/pricing/hero.tsx` written to `components/hero.tsx` as well, so a
 * multi-file component silently collided with itself and the second file
 * overwrote the first.
 *
 * Measured against `shadcn@3.8.5`: with a `target`, the path is written exactly
 * as declared. The stored path *is* the destination the author chose, so
 * copying it into `target` is lossless — and it is the only way to keep a
 * component's directory structure across the install.
 */
export function toRegistryFile(input: {
  path?: unknown;
  content?: unknown;
  type?: unknown;
  target?: unknown;
}): RegistryFile | null {
  const path = normalizeRegistryFilePath(input?.path);
  if (!path) return null;
  if (typeof input.content !== "string" || !input.content) return null;

  const type = normalizeRegistryFileType(input.type);
  // An explicit target wins: upstream registry files may address `~/...`, which
  // is a destination the CLI expands and this module must not rewrite.
  const target = normalizeRegistryFilePath(input.target) ?? path;

  return { path, content: input.content, type, target };
}

/**
 * Every npm package among `values`, and nothing else.
 *
 * The author's declaration and the import walk are different shapes of the same
 * answer, and the declaration is the untrusted one: it reaches the database
 * from a request body and can hold a path alias (`~/lib/utils`, `src/x`), a
 * relative path, or a subpath (`motion/react`). None of those are packages.
 * `shadcn add` writes this list straight into the consumer's package.json, so
 * a bad entry is an install failure that reports itself as a broken component.
 */
export function toPackageNames(values: Iterable<unknown>): string[] {
  const names = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const name = packageNameForSpecifier(value.trim());
    if (!name || HOST_PACKAGES.has(name)) continue;
    names.add(name);
  }
  return [...names].sort();
}

/**
 * A `registryDependencies` entry the CLI can actually resolve, or `null` when
 * there is no way to make one.
 *
 * The CLI's test for "is this a URL" is `new URL()`, so a relative `/r/button`
 * is not one: it is looked up as an item *name* in the default shadcn/ui
 * registry, which is not where shadway lives, and the install dies there with
 * a 404 that names a component nobody wrote. That is why an unresolvable entry
 * is dropped rather than passed through.
 */
export function normalizeRegistryDependency(value: unknown, origin: string): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Somebody else's registry, already absolute.
  if (ABSOLUTE_URL.test(trimmed)) return trimmed;

  // `@registry/name` belongs to the consumer's components.json. The CLI
  // resolves it there and throws on one it cannot find, so rewriting it into
  // our own `/r/` would be strictly worse than leaving it alone.
  if (NAMED_REGISTRY_REFERENCE.test(trimmed)) return trimmed;

  const slug = trimmed.replace(/^\/+|\/+$/g, "");
  if (!slug) return null;

  // Our own registry, and ours to address absolutely.
  const base = typeof origin === "string" ? origin.trim().replace(/\/+$/, "") : "";
  if (!/^https?:\/\/[^/]+/i.test(base)) return null;

  return `${base}/r/${slug}`;
}