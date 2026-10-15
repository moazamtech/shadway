/**
 * CSS + Tailwind parsing for the registry.
 *
 * The inputs arrive as inline strings from MongoDB rather than URLs, but the
 * output is the shadcn registry-item shape.
 */

/** Maps shadway's `registry` field onto the names the shadcn CLI expects. */
export function shadcnRegistrySlug(registry: string): string {
  switch (registry) {
    case "hooks":
      return "registry:hook";
    case "blocks":
      return "registry:block";
    case "icons":
      return "registry:ui";
    default:
      return `registry:${registry}`;
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
