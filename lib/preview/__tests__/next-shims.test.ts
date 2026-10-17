import { describe, expect, it } from "vitest";

import { NEXT_SHIMS as PUBLISHED_SHIMS } from "@/lib/preview/build";
import { NEXT_SHIMS as SANDBOX_SHIMS } from "@/lib/studio/sandpack";

/**
 * A component written for the App Router imports `next/*`, and the studio runs
 * it in two places that each have to answer that import themselves: the
 * sandbox, which is plain React, and the published document, which is a single
 * bundled file with no Next.js at all.
 *
 * The two maps are separate because the shapes are — the sandbox writes real
 * modules into a `node_modules` directory for its bundler to resolve, and the
 * published build hands esbuild a virtual namespace — but the *coverage* has to
 * agree. `next/form` was in neither, so `form-next-demo` resolved `Form` to
 * `undefined` and the whole preview came down with it. That is the failure this
 * holds shut.
 */

/**
 * Every Next.js module the public registry's blocks and examples import.
 *
 * Gathered from the registry rather than guessed: `next/link` comes from
 * `breadcrumb-responsive` and `combobox-responsive`, `next/form` from
 * `form-next-demo` and `form-next-complex`, and the rest are the modules the
 * blocks reach for through shared components.
 */
const REGISTRY_MODULES = [
  "next/image",
  "next/link",
  "next/form",
  "next/navigation",
  "next/router",
  "next/head",
  "next/script",
  "next/dynamic",
  "next/document",
];

/** How the sandbox spells a shim: a real module under a real `node_modules`. */
function sandboxPath(specifier: string): string {
  return `/node_modules/${specifier}.js`;
}

describe("Next.js stand-ins", () => {
  it("answers every module the registry imports, in the sandbox", () => {
    const missing = REGISTRY_MODULES.filter(
      (specifier) => !(sandboxPath(specifier) in SANDBOX_SHIMS)
    );
    expect(missing).toEqual([]);
  });

  it("answers every module the registry imports, in the published document", () => {
    const missing = REGISTRY_MODULES.filter((specifier) => !(specifier in PUBLISHED_SHIMS));
    expect(missing).toEqual([]);
  });

  it("keeps next/form a form element on both sides", () => {
    /**
     * A `<form>` whose `action` is a function is what `next/form` is for, and
     * React 19 runs a function action itself — so the stand-in is the element,
     * not a wrapper. Resolving it to an empty module instead is what made
     * `<Form>` render as `undefined`.
     */
    expect(PUBLISHED_SHIMS["next/form"]).toContain('React.createElement("form"');
    expect(SANDBOX_SHIMS[sandboxPath("next/form")]).toContain("<form");
  });

  it("re-exports the stand-ins through the sandbox's next barrel", () => {
    // A component that imports the package rather than a subpath resolves
    // through `/node_modules/next`, whose `main` is this barrel.
    const barrel = SANDBOX_SHIMS["/node_modules/next/index.js"];

    for (const name of ["Image", "Link", "Form", "Head", "Script"]) {
      expect(barrel, name).toContain(name);
    }
  });
});
