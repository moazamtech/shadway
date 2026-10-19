import { getComponentBySlug } from "@/lib/db/components";
import { cssVarsForComponent, mergeCssVars, shadcnRegistrySlug } from "@/lib/registry/parsers";
import { parseFullSlug, resolveRegistryDependencies } from "@/lib/registry/resolve";
import {
  isRegistryItemName,
  normalizeRegistryDependency,
  REGISTRY_ITEM_SCHEMA_URL,
  toPackageNames,
  toRegistryFile,
  type RegistryFile,
} from "@/lib/registry/types";
import { collectNpmDependencies } from "@/lib/studio/deps";

/**
 * Builds a shadcn registry item for a published component.
 *
 * This is the contract `npx shadcn add <url>` reads, so every field here is
 * load-bearing: `registryDependencies` must be installable URLs, `files` must
 * land at real paths, and `dependencies` must name every npm package the
 * installed code imports.
 *
 * What comes out of the database is not held to that contract — the category,
 * each file's `type`, the declared dependency names and the registry
 * dependency slugs are all free text that reached the database from a request
 * body — so none of it is passed through unchecked. Everything below goes
 * through `lib/registry/types.ts`, and `lib/registry/__tests__/item.test.ts`
 * holds the item against the published schema.
 */
export type RegistryItemInput = {
  slug: string;
  /** Optional `author/slug` form. */
  author?: string;
};

export async function buildRegistryItem(
  input: RegistryItemInput,
  options: { origin?: string } = {}
) {
  const parsed = parseFullSlug(input.author ? `${input.author}/${input.slug}` : input.slug);
  if (!parsed) return null;

  const component = await getComponentBySlug(parsed.slug);
  // getComponentBySlug already filters to status: "published"; the public
  // visibility check keeps unlisted copies link-only.
  if (!component || component.visibility !== "public") {
    return null;
  }

  // The item's name is also its URL. A slug that cannot survive one is not a
  // component anyone can install, so there is no item worth building from it.
  if (!isRegistryItemName(component.slug)) return null;

  // A per-author lookup would be more correct, but shadway keys components by
  // a globally unique slug, so the author qualifier only changes the URL.
  const resolution = await resolveRegistryDependencies(
    component.registryDependencies ?? []
  );

  // The component's own source plus everything it pulls in, in that order:
  // the first file to claim a path keeps it, so the component being installed
  // always wins over a dependency that happens to write to the same place.
  const files: RegistryFile[] = [];
  const claimed = new Set<string>();
  const claim = (file: RegistryFile | null) => {
    if (!file || claimed.has(file.path)) return;
    claimed.add(file.path);
    files.push(file);
  };

  claim(
    toRegistryFile({
      path: `components/ui/${component.slug}.tsx`,
      content: component.code,
      type: "registry:component",
    })
  );
  for (const file of component.files ?? []) {
    claim(toRegistryFile(file));
  }
  for (const file of Object.values(resolution.files)) {
    claim(toRegistryFile(file));
  }

  /**
   * Registry dependencies the CLI can resolve: absolute URLs to our own
   * registry, an absolute URL the author wrote, or an `@registry/name` the
   * consumer resolves from its own components.json.
   *
   * Anything else is dropped rather than shipped. A relative `/r/<slug>` looks
   * like it addresses shadway and does not: the CLI's URL test is `new URL()`,
   * which a relative path fails, so it falls through to being resolved as a
   * component *name* in the default shadcn/ui registry — where shadway does
   * not exist, and the install fails naming something the author never wrote.
   */
  const registryDependencies: string[] = [];
  for (const dep of component.registryDependencies ?? []) {
    const url = normalizeRegistryDependency(dep, options.origin ?? "");
    if (url) {
      if (!registryDependencies.includes(url)) registryDependencies.push(url);
    } else {
      resolution.warnings.push(
        `Dropped registry dependency "${String(dep).trim()}": not an absolute URL and no origin to resolve it against.`
      );
    }
  }

  /**
   * Every npm package the installed code needs.
   *
   * Three sources, because none of them is complete on its own:
   *
   *   - what the component's files import — the ground truth, and the reason a
   *     component importing `motion/react` and `react-icons/fa6` once shipped
   *     `dependencies: []` and installed into a project with neither;
   *   - what the component declared, which the walk cannot see when a package
   *     is used through a re-export or reached at runtime only;
   *   - what the components it pulls in declared.
   *
   * All three are untrusted shapes of the same question, so all three are
   * normalised by `toPackageNames` before they reach the consumer's
   * package.json. `react`, `react-dom` and `next` come out of the walk and stay
   * out of the item: the CLI runs inside a React project, and every item
   * declaring the framework it is being installed into is noise.
   */
  const dependencies = toPackageNames([
    ...(component.dependencies ?? []),
    ...Object.keys(resolution.npmDependencies),
    ...collectNpmDependencies(files),
  ]);

  const cssVars = mergeCssVars([cssVarsForComponent(component), resolution.cssVars]);
  const hasVars = Object.keys(cssVars.light).length > 0 || Object.keys(cssVars.dark).length > 0;

  return {
    $schema: REGISTRY_ITEM_SCHEMA_URL,
    name: component.slug,
    type: shadcnRegistrySlug(component.category || "ui"),
    title: component.title,
    description: component.description,
    dependencies,
    registryDependencies,
    files,
    ...(hasVars ? { cssVars } : {}),
    meta: {
      author: component.author.username,
      tags: component.tags,
      license: component.license,
      version: component.version,
    },
    ...(resolution.warnings.length
      ? { warnings: resolution.warnings }
      : {}),
  };
}
