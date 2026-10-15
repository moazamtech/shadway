import { getComponentBySlug } from "@/lib/db/components";
import { shadcnRegistrySlug } from "@/lib/registry/parsers";
import { parseFullSlug, resolveRegistryDependencies } from "@/lib/registry/resolve";

/**
 * Builds a shadcn registry item for a published component.
 *
 * This is the contract `npx shadcn add <url>` reads, so every field here is
 * load-bearing: `registryDependencies` must be installable URLs, `files` must
 * land at real paths, and `dependencies` must name every npm package the
 * installed code imports.
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
  if (!component || component.status !== "published" || component.visibility !== "public") {
    return null;
  }

  // A per-author lookup would be more correct, but shadway keys components by
  // a globally unique slug, so the author qualifier only changes the URL.
  const resolution = await resolveRegistryDependencies(
    component.registryDependencies ?? []
  );

  // The component's own source plus everything it pulls in.
  const files = [
    {
      path: `components/ui/${component.slug}.tsx`,
      content: component.code,
      type: "registry:component" as const,
    },
    ...(component.files ?? []).map((file) => ({
      path: file.path.startsWith("/") ? file.path.replace(/^\/+/, "") : file.path,
      content: file.content,
      type: file.type,
    })),
  ];

  for (const [path, file] of Object.entries(resolution.files)) {
    if (!files.some((existing) => existing.path === path)) {
      files.push({ path, content: file.content, type: file.type });
    }
  }

  // Rewrite bare registry dependencies into absolute URLs so the CLI can fetch
  // them without knowing shadway's origin. Relative entries are left untouched.
  const origin = options.origin ?? "";
  const registryDependencies = (component.registryDependencies ?? []).map((dep) => {
    const normalized = dep.trim().replace(/^\/+|\/+$/g, "");
    if (!normalized) return dep;
    if (normalized.includes("://")) return dep;
    return `${origin}/r/${normalized}`;
  });

  const hasVars =
    Object.keys(resolution.cssVars.light).length > 0 ||
    Object.keys(resolution.cssVars.dark).length > 0;

  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: component.slug,
    type: shadcnRegistrySlug(component.category || "ui"),
    title: component.title,
    description: component.description,
    dependencies: Object.keys(resolution.npmDependencies),
    registryDependencies,
    files,
    ...(hasVars ? { cssVars: resolution.cssVars } : {}),
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
