import { getComponentBySlug } from "@/lib/db/components";
import { cssVarsForComponent, mergeCssVars, shadcnRegistrySlug } from "@/lib/registry/parsers";
import { parseFullSlug, resolveRegistryDependencies } from "@/lib/registry/resolve";
import {
  isRegistryItemName,
  normalizeRegistryDependency,
  normalizeRegistryFilePath,
  REGISTRY_ITEM_SCHEMA_URL,
  toPackageNames,
  toRegistryFile,
  type RegistryFile,
} from "@/lib/registry/types";
import { collectNpmDependencies } from "@/lib/studio/deps";
import { hasShadcnFile, withShadcnFiles } from "@/lib/preview/shadcn-ui";

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

  /**
   * The item's type also decides where its source file belongs. A UI primitive
   * installs into `components/ui/`; a block or landing page into `components/`,
   * which is where shadcn puts blocks and where a consumer looks for one.
   */
  const itemType = shadcnRegistrySlug(component.category || "ui");
  const sourcePath =
    itemType === "registry:ui"
      ? `components/ui/${component.slug}.tsx`
      : `components/${component.slug}.tsx`;

  /**
   * When the source moves, the files beside it move with it.
   *
   * The author's project has one root — the studio always builds at
   * `components/component.tsx` — so their supporting file is `./install-panel`,
   * and their nested one is `./install/deep/stat`. Installing the source at
   * `components/ui/<slug>.tsx` and the supporters at `components/...` leaves
   * every one of those imports pointing at a file the CLI never wrote: the
   * install reports success and the consumer's first build fails on a module
   * the author never named. Rewriting the imports would be editing the author's
   * code; moving the files by the same delta keeps the relative edges exactly
   * as they were written.
   *
   * Only files under the author's own directory move, and only when the source
   * itself does; a block installed at `components/` keeps everything in place.
   */
  const authorDir = (() => {
    const authored =
      typeof component.componentPath === "string"
        ? normalizeRegistryFilePath(component.componentPath)
        : null;
    if (!authored) return null;
    const slash = authored.lastIndexOf("/");
    return slash === -1 ? "" : authored.slice(0, slash);
  })();
  const installedDir = itemType === "registry:ui" ? "components/ui" : "components";

  const relocate = (value: unknown): string | null => {
    const filePath = normalizeRegistryFilePath(value);
    if (!filePath || !authorDir || authorDir === installedDir) return filePath;
    if (!filePath.startsWith(`${authorDir}/`)) return filePath;
    return `${installedDir}/${filePath.slice(authorDir.length + 1)}`;
  };

  claim(
    toRegistryFile({
      path: sourcePath,
      content: component.code,
      type: itemType,
    })
  );
  for (const file of component.files ?? []) {
    const relocated = relocate(file?.path);
    if (!relocated) continue;
    claim(toRegistryFile({ ...file, path: relocated }));
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
   * The `components/ui/*` primitives the installed code imports.
   *
   * A component that renders `@/components/ui/dialog` is not a component on its
   * own, and until now its item said it was: the file list held the author's
   * source and nothing else, and the dependency list held `@radix-ui/react-dialog`
   * — so `shadcn add` reported success, wrote a component importing a module that
   * no longer exists in the consumer's project, and the failure surfaced as the
   * consumer's first `next dev` naming a file the author never mentioned. The npm
   * packages were there because the publish route expands these files before
   * walking imports, which made the omission harder to see: the item looked
   * thorough.
   *
   * Two things make these safe to declare:
   *
   * 1. `withShadcnFiles` resolves what the files actually reach, transitively, so
   *    `dialog` brings `button` with it and the author declares neither.
   * 2. `hasShadcnFile` gates the name. These are shadcn/ui's own primitives, so
   *    the CLI resolves a *bare* name against the default registry — exactly how
   *    shadcn's own items declare each other. A name that is not in the vendored
   *    set is not emitted here, because a bare name we cannot vouch for is
   *    looked up in a registry we do not control.
   *
   * A file the item already ships is skipped: the author may have written their
   * own `components/ui/button.tsx`, and declaring the dependency anyway would
   * have the CLI overwrite the file the author just installed with the item.
   *
   * Deliberately not folded into the declared-dependency loop above: a bare name
   * the *author* writes resolves against shadway (`<origin>/r/button`), which is
   * right for a shadway component they are referring to. This list is different
   * in kind — it is derived from files that came out of shadcn's registry, so it
   * points at shadcn's.
   *
   * The same expanded set is what the npm walk reads below, for the same reason:
   * `dialog` imports Radix, and the consumer installs the file that needs it.
   */
  const shipped = new Set(files.map((file) => file.path.replace(/^\/+/, "")));
  const expandedFiles = withShadcnFiles(files);
  const inferredUiDependencies = [
    ...new Set(
      expandedFiles
        .map((file) =>
          /^components\/ui\/([^/]+)\.(?:tsx|ts|jsx|js)$/.exec(
            file.path.replace(/^\/+/, "")
          )
        )
        .filter((match): match is RegExpExecArray => Boolean(match))
        .map((match) => match[1])
        /**
         * The name, not the file: `dialog`, which the CLI resolves against the
         * default registry. `hasShadcnFile` takes the vendored path, so this is
         * also the check that the name is one shadcn actually publishes.
         */
        .filter((name) => hasShadcnFile(`ui/${name}.tsx`))
        .filter((name) => !shipped.has(`components/ui/${name}.tsx`))
    ),
  ].sort();

  /** The item name a dependency entry ends at: `button`, `foo/bar`, `...`. */
  const terminalName = (dependency: string) =>
    (dependency.split("/").pop() ?? dependency).replace(/\.json$/, "");

  const declaredNames = new Set(registryDependencies.map(terminalName));
  for (const name of inferredUiDependencies) {
    if (declaredNames.has(terminalName(name))) continue;
    declaredNames.add(terminalName(name));
    registryDependencies.push(name);
  }

  /**
   * Every npm package the installed code needs.
   *
   * Three sources, because none of them is complete on its own:
   *
   *   - what the component's files import — the ground truth, and the reason a
   *     component importing `motion/react` and `react-icons/fa6` once shipped
   *     `dependencies: []` and installed into a project with neither. The walk
   *     runs over the expanded set, so a package reached only through a
   *     `components/ui` primitive counts as imported by this item, which the
   *     consumer will have installed;
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
    ...collectNpmDependencies(expandedFiles),
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
