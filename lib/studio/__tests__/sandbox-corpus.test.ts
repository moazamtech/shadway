import { describe, expect, it } from "vitest";

import { SHADCN_FILES } from "@/lib/preview/template/bundle";
import { withShadcnFiles, type PreviewFileInput } from "@/lib/preview/shadcn-ui";
import { compileProjectCss } from "@/lib/preview/tailwind";
import {
  collectNpmDependencies,
  packageNameForSpecifier,
  sandboxPackageVersion,
} from "@/lib/studio/deps";
import { buildSandpackProject } from "@/lib/studio/sandpack";
import { DEFAULT_STYLE_CODE } from "@/lib/studio/starter";

/**
 * The sandbox is only as good as its worst component.
 *
 * These run the whole corpus of vendored shadcn/ui sources through the same
 * two steps the studio runs them through — the import walk that mounts files
 * and the Tailwind compile that styles them — because the failures worth
 * catching are not per-component. They are the ones where a single
 * `@import "tw-animate-css"` takes down every preview, or a dependency nobody
 * pinned resolves to a new major and breaks every footer at once.
 */

const IMPORT_RE =
  /(?:\bimport\s+(?:[\s\S]*?\sfrom\s*)?|\bexport\s+(?:[\s\S]*?\sfrom\s*)|\bimport\s*\(\s*)(["'])([^"']+)\1/g;

function specifiersOf(source: string, kind: "relative" | "bare"): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const specifier = match[2];
    const isRelative = specifier.startsWith(".") || specifier.startsWith("/");
    if (isRelative === (kind === "relative")) found.push(specifier);
  }
  return found;
}

const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

/** Resolves a relative specifier against the paths a file map actually has. */
function resolvesIn(specifier: string, fromPath: string, paths: Set<string>): boolean {
  if (specifier.startsWith("/")) return paths.has(specifier) || hasWithExtension(specifier, paths);

  const stack = fromPath.split("/").slice(0, -1);
  for (const segment of specifier.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") stack.pop();
    else stack.push(segment);
  }

  // The walk drops the leading empty segment that makes the path absolute.
  const base = `/${stack.filter(Boolean).join("/")}`;
  return paths.has(base) || hasWithExtension(base, paths) || hasIndex(base, paths);
}

function hasWithExtension(base: string, paths: Set<string>) {
  return EXTENSIONS.some((extension) => paths.has(base + extension));
}

function hasIndex(base: string, paths: Set<string>) {
  return EXTENSIONS.some((extension) => paths.has(`${base}/index${extension}`));
}

/** A page that reaches every vendored shadcn/ui component at once. */
function kitchenSinkProject(): PreviewFileInput[] {
  const components = Object.keys(SHADCN_FILES)
    .filter((path) => path.startsWith("ui/"))
    .map((path) => path.replace(/^ui\//, "").replace(/\.tsx$/, ""));

  const imports = components
    .map((name) => `import * as ${name.replace(/-/g, "_")} from "@/components/ui/${name}";`)
    .join("\n");

  return [
    {
      path: "/app/page.tsx",
      content: `${imports}

export default function Page() {
  return <main className="bg-background text-foreground">{Object.keys({${
        components.map((name) => name.replace(/-/g, "_")).join(", ")
      }}).join(", ")}</main>;
}
`,
    },
    { path: "/app/globals.css", content: DEFAULT_STYLE_CODE },
  ];
}

describe("the shadcn/ui corpus", () => {
  it("is not empty, and is all reachable through the import walk", () => {
    expect(Object.keys(SHADCN_FILES).length).toBeGreaterThan(30);

    const merged = withShadcnFiles(kitchenSinkProject());
    const mounted = new Set(merged.map((file) => file.path));

    // Every component the page names is mounted.
    for (const path of Object.keys(SHADCN_FILES)) {
      if (path.startsWith("ui/")) {
        expect(mounted, path).toContain(`/components/${path}`);
      }
    }

    // And nothing is mounted twice.
    expect(mounted.size).toBe(merged.length);
  });

  it("emits a sandbox project whose imports all resolve", () => {
    const project = buildSandpackProject({
      files: Object.fromEntries(
        withShadcnFiles(kitchenSinkProject()).map((file) => [file.path, file.content])
      ),
      compiledCss: "/* css */",
    });

    const paths = new Set(Object.keys(project.files));
    const dangling: string[] = [];

    for (const [path, content] of Object.entries(project.files)) {
      for (const specifier of specifiersOf(content, "relative")) {
        // The shims for a plain-React sandbox reach into `node_modules`, which
        // is a real directory in the emitted map.
        if (!resolvesIn(specifier, path, paths)) dangling.push(`${path} -> ${specifier}`);
      }
    }

    expect(dangling).toEqual([]);
  });

  it("styles the whole corpus, animations included", async () => {
    const merged = withShadcnFiles(kitchenSinkProject());
    const css = await compileProjectCss(merged, DEFAULT_STYLE_CODE);

    expect(css.length).toBeGreaterThan(10_000);

    // The shadcn/ui theme tokens resolved, so the components are actually
    // themed. They are checked through a utility rather than a variable:
    // `@theme inline` folds the value straight into the rule.
    expect(css).toContain(".bg-background");
    expect(css).toContain(".text-foreground");

    /**
     * Every shadcn/ui component that opens — dialog, dropdown, popover, select,
     * tooltip — animates with these, and a project whose stylesheet lacks them
     * renders every one of those with no transition at all.
     */
    for (const utility of ["animate-in", "fade-in-0", "zoom-in-95", "slide-in-from-top-2"]) {
      expect(css, utility).toContain(utility);
    }
  });

  it("compiles a stylesheet that imports tw-animate-css itself", async () => {
    const shadcnGlobals = `@import "tailwindcss";
@import "tw-animate-css";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}
:root { --background: oklch(1 0 0); --foreground: oklch(0.145 0 0); }
`;

    // This is the shape every shadcn project's `globals.css` arrives in. It
    // used to throw, and a throwing compile leaves the author with no preview.
    const css = await compileProjectCss(
      [
        {
          path: "/app/page.tsx",
          content: `<div className="animate-in fade-in-0 bg-background text-foreground" />`,
        },
      ],
      shadcnGlobals
    );

    expect(css).toContain("animate-in");
    expect(css).toContain(".bg-background");
  });

  it("survives a stylesheet the host cannot resolve", async () => {
    // `globals.css` is the one file authors paste wholesale, so it can easily
    // arrive importing a stylesheet this host has never heard of.
    const css = await compileProjectCss(
      [{ path: "/app/page.tsx", content: `<div className="bg-background" />` }],
      `@import "tailwindcss";\n@import "@acme/theme/tokens.css";\n`
    );

    expect(css).toContain("bg-background");
  });
});

describe("sandbox dependencies", () => {
  it("pins every package the vendored corpus imports", () => {
    const files = Object.entries(SHADCN_FILES).map(([path, content]) => ({ path, content }));
    const unpinned: string[] = [];

    for (const name of collectNpmDependencies(files)) {
      if (name === "react" || name === "react-dom") continue;
      if (sandboxPackageVersion(name) === "latest") unpinned.push(name);
    }

    /**
     * These are the packages no author file mentions — the vendored sources are
     * the only place they appear — so an unpinned one is a package that is
     * installed at whatever `latest` happens to be, with no version of this
     * site ever having run against it.
     */
    expect(unpinned).toEqual([]);
  });

  it("reads the corpus's package names the way npm does", () => {
    expect(packageNameForSpecifier("@base-ui/react")).toBe("@base-ui/react");
    expect(packageNameForSpecifier("@shadcn/react")).toBe("@shadcn/react");
    expect(sandboxPackageVersion("@base-ui/react")).not.toBe("latest");
  });
});
