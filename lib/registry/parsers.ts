/**
 * CSS + Tailwind parsing for the registry.
 *
 * The inputs arrive as inline strings from MongoDB rather than URLs, but the
 * output is the shadcn registry-item shape.
 */
import { registryTypeFor } from "@/lib/categories";
import { isRegistryItemType, type RegistryItemType } from "@/lib/registry/types";

/**
 * Maps shadway's `registry` field onto the names the shadcn CLI expects.
 *
 * The item's `type` has to be one of the values in `REGISTRY_ITEM_TYPES` and
 * nothing else. The old `registry:${registry}` default meant a component filed
 * under `hero` or `marketing` shipped `"type": "registry:hero"`, which is not
 * one of them: it built, it served, and `shadcn add` had nothing to install.
 *
 * So the taxonomy in `lib/categories.ts` decides this, a value that names
 * neither group is resolved through the legacy aliases every component already
 * in the database was filed under, and the result is checked against the
 * published enum on the way out. That last step is what stops the bug from
 * coming back: this function used to hand back a type nobody had checked, from
 * a switch whose cases were written out longhand and left to rot.
 *
 * `example` is one of those rotted cases. It used to return
 * `registry:example`, which the CLI's runtime schema tolerates but which the
 * published schema — the one this item declares in `$schema` — does not list.
 */
export function shadcnRegistrySlug(registry: string): RegistryItemType {
  switch (registry) {
    case "hooks":
      return "registry:hook";
    case "blocks":
      return "registry:block";
    case "icons":
      return "registry:ui";
    case "lib":
    case "utils":
      return "registry:lib";
    case "example":
    case "examples":
      return "registry:component";
    default: {
      const candidate = registryTypeFor(registry);
      return isRegistryItemType(candidate) ? candidate : "registry:ui";
    }
  }
}

export type CssVars = {
  light: Record<string, string>;
  dark: Record<string, string>;
};

/**
 * Pulls `--custom-property` declarations out of a `:root` / `.dark` block.
 * A missing block simply yields no variables for that theme rather than an
 * error.
 */
export function extractCssVars(css: string): CssVars {
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};

  const rootMatch = css.match(/:root\s*\{([^}]*)\}/)?.[1];
  if (rootMatch) {
    for (const match of rootMatch.matchAll(/--([^:]+):\s*([^;]+);/g)) {
      light[`--${match[1]?.trim()}`] = match[2]?.trim() ?? "";
    }
  }

  const darkMatch = css.match(/\.dark\s*\{([^}]*)\}/)?.[1];
  if (darkMatch) {
    for (const match of darkMatch.matchAll(/--([^:]+):\s*([^;]+);/g)) {
      dark[`--${match[1]?.trim()}`] = match[2]?.trim() ?? "";
    }
  }

  return { light, dark };
}

/** Merges many components' `:root` / `.dark` blocks, later themes win. */
export function mergeCssVars(sources: CssVars[]): CssVars {
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};

  for (const source of sources) {
    Object.assign(light, source.light);
    Object.assign(dark, source.dark);
  }

  return {
    light: Object.keys(light).length ? light : {},
    dark: Object.keys(dark).length ? dark : {},
  };
}

/**
 * The theme tokens one component defines.
 *
 * From its CSS files, and — for a component that never shipped one — from the
 * `cssVars` the studio already parsed out of the author's stylesheet.
 *
 * This lives here rather than inline in the resolver because it has to be the
 * *same* answer for both callers: a component's own tokens used to be read for
 * the dependency tree and then thrown away for the component being installed,
 * so a component whose styling depended on its own custom properties shipped
 * with none of them and rendered with undefined values.
 */
export function cssVarsForComponent(component: {
  files?: { path: string; content: string }[];
  cssVars?: Record<string, Record<string, string>>;
}): CssVars {
  const vars: CssVars = { light: {}, dark: {} };

  for (const file of component.files ?? []) {
    if (!file?.path?.endsWith(".css") || typeof file.content !== "string") continue;
    const extracted = extractCssVars(file.content);
    Object.assign(vars.light, extracted.light);
    Object.assign(vars.dark, extracted.dark);
  }

  if (!Object.keys(vars.light).length && !Object.keys(vars.dark).length) {
    const stored = component.cssVars;
    if (stored && typeof stored === "object") {
      for (const [theme, values] of Object.entries(stored)) {
        if ((theme === "light" || theme === "dark") && values && typeof values === "object") {
          Object.assign(vars[theme], values as Record<string, string>);
        }
      }
    }
  }

  return vars;
}
