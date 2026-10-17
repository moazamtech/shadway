import { describe, expect, it } from "vitest";
import {
  collectNpmDependencies,
  packageNameForSpecifier,
  sandboxPackageVersion,
} from "@/lib/studio/deps";

describe("packageNameForSpecifier", () => {
  it("takes the package root, not the subpath", () => {
    expect(packageNameForSpecifier("react-icons/fa6")).toBe("react-icons");
    expect(packageNameForSpecifier("lodash/fp")).toBe("lodash");
    expect(packageNameForSpecifier("@radix-ui/react-dialog")).toBe("@radix-ui/react-dialog");
    expect(packageNameForSpecifier("@radix-ui/react-dialog/dist/index")).toBe(
      "@radix-ui/react-dialog"
    );
  });

  it("drops relative, aliased and builtin specifiers", () => {
    expect(packageNameForSpecifier("./local")).toBeNull();
    expect(packageNameForSpecifier("../up")).toBeNull();
    expect(packageNameForSpecifier("/abs")).toBeNull();
    expect(packageNameForSpecifier("@/components/ui/button")).toBeNull();
    expect(packageNameForSpecifier("node:fs")).toBeNull();
    expect(packageNameForSpecifier("fs")).toBeNull();
    expect(packageNameForSpecifier("")).toBeNull();
  });
});

describe("collectNpmDependencies", () => {
  const files = [
    {
      path: "/app/page.tsx",
      content: `
        import { Hero } from "@/components/hero";
        import "side-effect-pkg";
        import type { T } from "zod";
        export { foo } from "@radix-ui/react-dialog";
        export * from "clsx";
        const lazy = () => import("motion");
        const cjs = require("lodash");
        const icon = require("react-icons/fa6");
        import "./local.css";
      `,
    },
  ];

  it("finds every import form a package can arrive through", () => {
    expect(collectNpmDependencies(files)).toEqual([
      "@radix-ui/react-dialog",
      "clsx",
      "lodash",
      "motion",
      "react-icons",
      "side-effect-pkg",
      "zod",
    ]);
  });

  it("is sorted and deduped across files", () => {
    const duped = [
      { path: "/a.ts", content: `import { x } from "react-icons/fa6";` },
      { path: "/b.ts", content: `import { y } from "react-icons/fa";` },
    ];
    expect(collectNpmDependencies(duped)).toEqual(["react-icons"]);
  });
});

describe("sandboxPackageVersion", () => {
  it("pins what the design system is built on and lets the rest float", () => {
    expect(sandboxPackageVersion("lucide-react")).toBe("^0.544.0");
    expect(sandboxPackageVersion("some-unlisted-pkg")).toBe("latest");
  });

  /**
   * The sandbox compiles a component against the same package the published
   * build uses. Anything `latest` has moved a major past is pinned, because a
   * component written against the old major stops working the moment the
   * sandbox installs the new one — which is what happened to every footer
   * importing `Github` from `lucide-react`.
   */
  it("pins every package `latest` has moved a major past", () => {
    for (const name of [
      "lucide-react",
      "recharts",
      "react-resizable-panels",
      "react-day-picker",
      "motion",
      "framer-motion",
    ]) {
      expect(sandboxPackageVersion(name), name).not.toBe("latest");
    }
  });

  it("pins the packages only the vendored registry imports", () => {
    // No author file ever mentions these, so nothing else can pull them in.
    expect(sandboxPackageVersion("@base-ui/react")).not.toBe("latest");
    expect(sandboxPackageVersion("@shadcn/react")).not.toBe("latest");
    expect(sandboxPackageVersion("radix-ui")).not.toBe("latest");
  });
});
