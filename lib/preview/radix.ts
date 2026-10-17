/**
 * The unified `radix-ui` package, split back into the packages it re-exports.
 *
 * Newer shadcn/ui sources import the barrel:
 *
 *   import { Dialog as DialogPrimitive } from "radix-ui";
 *
 * `radix-ui` is a single package that does nothing but re-export all 36
 * `@radix-ui/react-*` packages as namespaces — and it does so *eagerly*, with
 * one `import * as X from "@radix-ui/react-x"` per package in its `index.mjs`.
 * So importing one primitive makes the bundler resolve and parse every Radix
 * package before tree-shaking discards 35 of them. Measured on this machine,
 * bundling `Slot` either way produces ~12 KB of output and takes:
 *
 *   from "radix-ui"                1565 ms
 *   from "@radix-ui/react-slot"      44 ms
 *
 * That is the whole cost of the publish build, and the sandbox pays it again
 * on every recompile. Splitting the import is a pure source-to-source rewrite,
 * and the faithful one binds a *namespace*: the barrel's named export is the
 * namespace object itself — `import * as reactDialog from
 * "@radix-ui/react-dialog"` then `export { reactDialog as Dialog }` — so a
 * component written against it says `DialogPrimitive.Root`, `Slot.Root`,
 * `TooltipPrimitive.Provider`.
 *
 *   import { Dialog as D } from "radix-ui"
 *     -> import * as D from "@radix-ui/react-dialog"
 *
 * Emitting `import { Dialog as D } from "@radix-ui/react-dialog"` instead
 * binds that package's `Dialog` *component*, which is an alias of `Root` — and
 * then every `D.Root` in the source is `undefined`. It is a namespace member
 * access, so nothing fails at build time; it fails when React renders, with
 * "element type is invalid", in `label`, `dialog` and everything built on them.
 *
 * The map is spelled out rather than derived from `PascalCase` -> `kebab-case`,
 * because a name this code guessed wrong would silently break a component
 * instead of failing loudly. `sandbox-corpus.test.ts` asserts that every name
 * the corpus imports has an entry, and `radix-namespace.test.ts` renders the
 * components whose members this rewrite has to preserve.
 */

const RADIX_PACKAGES: Record<string, string> = {
  AccessibleIcon: "@radix-ui/react-accessible-icon",
  Accordion: "@radix-ui/react-accordion",
  AlertDialog: "@radix-ui/react-alert-dialog",
  AspectRatio: "@radix-ui/react-aspect-ratio",
  Avatar: "@radix-ui/react-avatar",
  Checkbox: "@radix-ui/react-checkbox",
  Collapsible: "@radix-ui/react-collapsible",
  ContextMenu: "@radix-ui/react-context-menu",
  Dialog: "@radix-ui/react-dialog",
  Direction: "@radix-ui/react-direction",
  DropdownMenu: "@radix-ui/react-dropdown-menu",
  Form: "@radix-ui/react-form",
  HoverCard: "@radix-ui/react-hover-card",
  Label: "@radix-ui/react-label",
  Menubar: "@radix-ui/react-menubar",
  NavigationMenu: "@radix-ui/react-navigation-menu",
  Popover: "@radix-ui/react-popover",
  Portal: "@radix-ui/react-portal",
  Progress: "@radix-ui/react-progress",
  RadioGroup: "@radix-ui/react-radio-group",
  ScrollArea: "@radix-ui/react-scroll-area",
  Select: "@radix-ui/react-select",
  Separator: "@radix-ui/react-separator",
  Slider: "@radix-ui/react-slider",
  Slot: "@radix-ui/react-slot",
  Switch: "@radix-ui/react-switch",
  Tabs: "@radix-ui/react-tabs",
  Toast: "@radix-ui/react-toast",
  Toggle: "@radix-ui/react-toggle",
  ToggleGroup: "@radix-ui/react-toggle-group",
  Toolbar: "@radix-ui/react-toolbar",
  Tooltip: "@radix-ui/react-tooltip",
  VisuallyHidden: "@radix-ui/react-visually-hidden",
};

/** The packages `splitRadixImports` can produce. */
export const RADIX_SPLIT_PACKAGES: string[] = Object.values(RADIX_PACKAGES);

/** The package behind a `radix-ui` export name, or null if there isn't one. */
export function radixPackageFor(name: string): string | null {
  return RADIX_PACKAGES[name] ?? null;
}

/**
 * Matches a whole `import { … } from "radix-ui"` statement, newline included at
 * the end — the trailing run is `[ \t]*;?` rather than `\s*;?` on purpose, so
 * the newline that follows the statement is left where it was. Consuming it
 * would glue the next line of the file onto the rewritten import.
 */
const RADIX_IMPORT_RE =
  /^([ \t]*)import\s+(type\s+)?\{([^}]*)\}\s*from\s*(["'])radix-ui\4([ \t]*)(;?)/gm;

/**
 * Rewrites every `import { … } from "radix-ui"` into one namespace import per
 * package.
 *
 *   import { Slot } from "radix-ui";
 *   import { Dialog as D, Slot } from "radix-ui";
 *   =>
 *   import * as Slot from "@radix-ui/react-slot";
 *   import * as D from "@radix-ui/react-dialog";
 *   import * as Slot from "@radix-ui/react-slot";
 *
 * A statement naming something unknown is left exactly as it was — a barrel
 * import that works slowly beats a rewrite that breaks a component — and
 * `unsplitRadixNames` reports what was left behind.
 */
export function splitRadixImports(content: string): string {
  if (!content.includes("radix-ui")) return content;

  return content.replace(
    RADIX_IMPORT_RE,
    (statement, indent: string, isType: string, names: string, _quote: string, gap: string, semicolon: string) => {
      const bindings = names
        .split(",")
        .map((raw) => raw.replace(/\btype\b/, "").trim())
        .filter(Boolean);

      if (!bindings.length) return statement;

      const resolved = bindings.map((binding) => {
        const [source, alias] = binding.split(/\s+as\s+/).map((part) => part.trim());
        return { local: alias ?? source, package: radixPackageFor(source) };
      });

      // One unknown name means the statement cannot be split safely at all:
      // emitting the rest would leave that binding undefined.
      if (resolved.some((entry) => !entry.package)) return statement;

      return resolved
        .map(
          (entry, index) =>
            `${indent}import ${isType ? "type " : ""}* as ${entry.local} from "${entry.package}"${
              index === resolved.length - 1 ? `${gap}${semicolon}` : ";"
            }`
        )
        .join("\n");
    }
  );
}

/** `radix-ui` export names a source imports that have no package mapping. */
export function unsplitRadixNames(content: string): string[] {
  const unknown = new Set<string>();

  for (const match of content.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']radix-ui["']/g)) {
    for (const raw of match[1].split(",")) {
      const binding = raw.replace(/\btype\b/, "").trim();
      if (!binding) continue;
      const source = binding.split(/\s+as\s+/)[0].trim();
      if (!radixPackageFor(source)) unknown.add(source);
    }
  }

  return [...unknown];
}
