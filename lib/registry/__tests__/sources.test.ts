import { describe, expect, it } from "vitest";

import { reachableSourceFiles, retargetImports } from "@/lib/registry/sources";

/**
 * What a published component *is*.
 *
 * The studio stores the author's whole project. That map still holds the
 * starter's `components/component.tsx` after it has been replaced, plus the
 * demo page and the stylesheet. Shipping the map verbatim is what put a file
 * reading "Shadway Starter" into an installed component, and what let "Copy"
 * hand somebody a scaffold. These are the rules that keep the item to the
 * component.
 */

describe("reachableSourceFiles", () => {
  it("drops the starter scaffold the component never imports", () => {
    const files = reachableSourceFiles({
      componentPath: "/components/hero.tsx",
      code: `import { motion } from "motion/react";\n\nexport function Hero() {\n  return <motion.div />;\n}\n`,
      files: [
        {
          path: "components/component.tsx",
          content: "export default function MyComponent() {\n  return <p>Shadway Starter</p>;\n}\n",
        },
        { path: "/app/page.tsx", content: "export default function Page() { return null; }\n" },
        { path: "/app/globals.css", content: "body { margin: 0; }\n" },
      ],
    });

    expect(files.map((file) => file.path)).toEqual(["/components/hero.tsx"]);
  });

  it("follows relative, nested, directory and alias imports", () => {
    const entry = `import { Panel } from "./ui/panel";
import { Stat } from "./deep/stat";
import { cn } from "@/lib/cn";
import { Widget } from "./widgets";

export function Hero() {
  return <Panel><Stat /><Widget /></Panel>;
}
`;

    const files = reachableSourceFiles({
      componentPath: "/components/hero.tsx",
      code: entry,
      files: [
        { path: "components/hero.tsx", content: entry },
        { path: "components/ui/panel.tsx", content: "export const Panel = () => null;\n" },
        { path: "components/deep/stat.tsx", content: "export const Stat = () => null;\n" },
        { path: "lib/cn.ts", content: "export const cn = (...c: string[]) => c.join(' ');\n" },
        { path: "components/widgets/index.tsx", content: "export const Widget = () => null;\n" },
        { path: "components/unused.tsx", content: "export const unused = 1;\n" },
      ],
    });

    expect(files.map((file) => file.path)).toEqual([
      "/components/hero.tsx",
      "/components/ui/panel.tsx",
      "/components/deep/stat.tsx",
      "/lib/cn.ts",
      "/components/widgets/index.tsx",
    ]);
  });

  it("takes the entry from the stored code, not a stale copy of the file", () => {
    const files = reachableSourceFiles({
      componentPath: "/components/hero.tsx",
      code: "export const fresh = 1;\n",
      files: [
        { path: "components/hero.tsx", content: "export const stale = 1;\n" },
        { path: "components/part.tsx", content: "export const part = 1;\n" },
      ],
    });

    expect(files[0]).toMatchObject({ path: "/components/hero.tsx", content: "export const fresh = 1;\n" });
    expect(files.map((file) => file.path)).toEqual(["/components/hero.tsx"]);
  });

  it("returns nothing when there is no component to start from", () => {
    expect(reachableSourceFiles({ files: [{ path: "components/part.tsx", content: "x" }] })).toEqual(
      []
    );
  });
});

describe("retargetImports", () => {
  const authorPaths = new Set([
    "/components/component.tsx",
    "/components/panel.tsx",
    "/components/deep/stat.tsx",
    "/lib/shared.ts",
  ]);
  const installed = new Map([
    ["/components/component.tsx", "/components/ui/pricing-hero.tsx"],
    ["/components/panel.tsx", "/components/ui/panel.tsx"],
    ["/components/deep/stat.tsx", "/components/ui/deep/stat.tsx"],
    ["/lib/shared.ts", "/lib/shared.ts"],
  ]);
  const base = {
    authorPaths,
    installed,
    entry: "/components/component.tsx",
  };

  it("repoints an alias that named the author's directory", () => {
    const content = `import { Stat } from "@/components/deep/stat";\n\nexport default function Hero() {\n  return <Stat />;\n}\n`;

    expect(retargetImports({ ...base, content, from: "/components/component.tsx" })).toBe(
      `import { Stat } from "@/components/ui/deep/stat";\n\nexport default function Hero() {\n  return <Stat />;\n}\n`
    );
  });

  it("repoints anything that named the renamed entry", () => {
    const content = `import { Hero } from "./component";\n\nexport const Panel = () => <Hero />;\n`;

    expect(retargetImports({ ...base, content, from: "/components/panel.tsx" })).toBe(
      `import { Hero } from "@/components/ui/pricing-hero";\n\nexport const Panel = () => <Hero />;\n`
    );
  });

  it("leaves relative edges between files that keep their names alone", () => {
    const content = `import "./deep/stat";\nimport { x } from "@/lib/shared";\n`;

    expect(retargetImports({ ...base, content, from: "/components/panel.tsx" })).toBe(content);
  });

  it("leaves modules outside the component alone", () => {
    const content = `import { Button } from "@/components/ui/button";\nimport { motion } from "motion/react";\n`;

    expect(retargetImports({ ...base, content, from: "/components/component.tsx" })).toBe(content);
  });
});
