import { describe, expect, it } from "vitest";

import {
  collectNpmDependencies,
  packageNameForSpecifier,
  sandboxPackageVersion,
  SANDBOX_PACKAGE_VERSIONS,
} from "@/lib/studio/deps";
import { RADIX_SPLIT_PACKAGES } from "@/lib/preview/radix";

/**
 * What the sandbox installs, and what it must not.
 *
 * Every failure in this file is one that builds fine and fails on screen, or
 * fails so early the author never sees their own error.
 */

describe("packageNameForSpecifier", () => {
  it("names the package an import resolves to", () => {
    expect(packageNameForSpecifier("react/jsx-runtime")).toBe("react");
    expect(packageNameForSpecifier("@radix-ui/react-dialog")).toBe("@radix-ui/react-dialog");
    expect(packageNameForSpecifier("motion/react")).toBe("motion");
  });

  it("has no package for a relative path", () => {
    expect(packageNameForSpecifier("./sibling")).toBeNull();
    expect(packageNameForSpecifier("../parent/file")).toBeNull();
    expect(packageNameForSpecifier("/absolute/file")).toBeNull();
  });

  /**
   * A path alias that reads as a package name poisons the whole install.
   *
   * `~/` is the most common alias in a shadcn project after `@/*`, and a block
   * that uses it put a package literally named `~` into `/package.json`. The
   * dependency install then failed, the bundler never ran, and the author got an
   * empty pane instead of the message that their own import did not resolve.
   */
  it("has no package for a path alias", () => {
    for (const specifier of [
      "@/components/ui/button",
      "~/components/sections/hero",
      "@src/lib/utils",
      "@components/ui/button",
      "src/components/hero",
      "components/hero",
      "app/page",
      "lib/utils",
      "~",
    ]) {
      expect(packageNameForSpecifier(specifier), specifier).toBeNull();
    }
  });

  it("has no package for a node builtin", () => {
    expect(packageNameForSpecifier("node:fs")).toBeNull();
    expect(packageNameForSpecifier("fs")).toBeNull();
    expect(packageNameForSpecifier("path")).toBeNull();
  });

  it("does not read a capitalised segment as a package", () => {
    expect(packageNameForSpecifier("Components/hero")).toBeNull();
  });
});

describe("collectNpmDependencies", () => {
  it("reads the packages a project imports, and nothing else", () => {
    const files = [
      { path: "/components/hero.tsx", content: 'import { motion } from "motion/react";' },
      { path: "/app/page.tsx", content: 'import Hero from "@/components/hero";' },
    ];
    expect(collectNpmDependencies(files)).toEqual(["motion"]);
  });

  it("does not read a stylesheet's imports as JavaScript ones", () => {
    const files = [
      { path: "/app/globals.css", content: '@import "tailwindcss";\n@import "tw-animate-css";' },
    ];
    expect(collectNpmDependencies(files)).toEqual([]);
  });

  /**
   * The one that ships a broken preview: an alias that reaches `latest` lands
   * in `/package.json` and takes the install — and therefore the entire preview
   * — down with it.
   */
  it("never emits a specifier that could not be installed", () => {
    const files = [
      {
        path: "/components/hero.tsx",
        content: [
          'import { motion } from "motion/react";',
          'import Hero from "~/components/hero";',
          'import { cn } from "@/lib/utils";',
          'import { Button } from "@components/ui/button";',
        ].join("\n"),
      },
    ];

    expect(collectNpmDependencies(files)).toEqual(["motion"]);
  });
});

describe("SANDBOX_PACKAGE_VERSIONS", () => {
  /**
   * Six of the packages the barrel split can emit were unreachable from the
   * corpus — the split rewrites `radix-ui` into the per-primitive packages, and
   * the corpus test that could have caught them forbids the barrel, so the six
   * names could never appear in it. A name with no entry resolves to `latest`,
   * which is the exact failure this table exists to prevent.
   */
  it("pins every package the barrel split can emit", () => {
    const unpinned = [...RADIX_SPLIT_PACKAGES].filter(
      (name) => !(name in SANDBOX_PACKAGE_VERSIONS)
    );

    expect(unpinned).toEqual([]);
  });

  /**
   * A caret on `0.0.x` is an exact pin, so a typo there is invisible until a
   * component installs a renderer several majors behind the one it was written
   * against — which is how `ogl` ended up at `0.0.11` while the site runs
   * `1.0.11`.
   */
  it("pins a range that actually admits an upgrade", () => {
    const dead = Object.entries(SANDBOX_PACKAGE_VERSIONS).filter(
      ([, range]) => /^[\^~]?0\.0\.\d+$/.test(range)
    );

    expect(dead).toEqual([]);
  });
});

describe("sandboxPackageVersion", () => {
  it("answers the range when there is one", () => {
    expect(sandboxPackageVersion("lucide-react")).toBe(SANDBOX_PACKAGE_VERSIONS["lucide-react"]);
  });

  it("falls back rather than failing the install", () => {
    expect(sandboxPackageVersion("a-package-nobody-pinned")).toBe("latest");
  });
});
