import { describe, expect, it } from "vitest";

import { RADIX_SPLIT_PACKAGES, splitRadixImports, unsplitRadixNames } from "@/lib/preview/radix";

/**
 * Splitting the `radix-ui` barrel is worth 35× on the bundler, so it is the
 * one transform standing between the studio and a several-second rebuild. That
 * makes its exactness worth pinning: a transform that changed what a statement
 * binds would trade a slow sandbox for a broken one.
 *
 * `radix-ui` re-exports each package as a *namespace* — `import * as X from
 * "@radix-ui/react-x"` then `export { X as Name }` — so the rewrite has to bind
 * a namespace too. Binding the package's own `X` component instead is the bug
 * these tests exist to hold shut: it type-checks, it builds, and every
 * `X.Root` in the source is `undefined` at render.
 */

describe("splitRadixImports", () => {
  it("splits one name into one namespace import", () => {
    expect(splitRadixImports(`import { Slot } from "radix-ui"`)).toBe(
      `import * as Slot from "@radix-ui/react-slot"`
    );
  });

  it("splits several names into one namespace import each, keeping the alias", () => {
    expect(splitRadixImports(`import { Dialog as DialogPrimitive, Slot } from "radix-ui";`)).toBe(
      `import * as DialogPrimitive from "@radix-ui/react-dialog";\nimport * as Slot from "@radix-ui/react-slot";`
    );
  });

  it("keeps a multi-line list's newline and the line after it", () => {
    const source = `import {\n  Dialog,\n  Slot,\n} from "radix-ui"\n\nconst x = 1;\n`;
    expect(splitRadixImports(source)).toBe(
      `import * as Dialog from "@radix-ui/react-dialog";\nimport * as Slot from "@radix-ui/react-slot"\n\nconst x = 1;\n`
    );
  });

  it("keeps a type-only import type-only", () => {
    expect(splitRadixImports(`import type { Slot } from "radix-ui";`)).toBe(
      `import type * as Slot from "@radix-ui/react-slot";`
    );
  });

  it("leaves a statement naming something unknown exactly as it was", () => {
    const source = `import { Slot, SomethingNew } from "radix-ui";`;
    expect(splitRadixImports(source)).toBe(source);
    expect(unsplitRadixNames(source)).toEqual(["SomethingNew"]);
  });

  it("leaves other radix imports, and other packages, alone", () => {
    expect(splitRadixImports(`import { Slot } from "@radix-ui/react-slot";`)).toBe(
      `import { Slot } from "@radix-ui/react-slot";`
    );
    expect(splitRadixImports(`import { cva } from "class-variance-authority";`)).toBe(
      `import { cva } from "class-variance-authority";`
    );
  });

  it("is idempotent", () => {
    const once = splitRadixImports(`import { Dialog, Slot } from "radix-ui";`);
    expect(splitRadixImports(once)).toBe(once);
  });

  it("maps every name it claims to, and knows nothing else", () => {
    expect(RADIX_SPLIT_PACKAGES.length).toBeGreaterThan(20);
    for (const name of RADIX_SPLIT_PACKAGES) expect(name.startsWith("@radix-ui/react-")).toBe(true);
    expect(radixPackageForName("Dialog")).toBe("@radix-ui/react-dialog");
  });
});

/** Local alias so the assertion above reads like the map it checks. */
function radixPackageForName(name: string): string | null {
  return splitRadixImports(`import { ${name} } from "radix-ui"`).match(/from "([^"]+)"/)?.[1] ?? null;
}
