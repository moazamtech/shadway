import { describe, expect, it } from "vitest";

import { relativeImport } from "@/lib/studio/sandpack";

/**
 * The sandbox hands its bundler relative paths, so a path that is one level off
 * is a module that does not resolve.
 *
 * Every path the studio builds is `/`-rooted and the entry always sits at the
 * root (`/App.tsx`). Counting that leading empty segment as a directory made
 * every result one `..` too high — `@/components/ui/button` became
 * `../../components/ui/button` — which Sandpack absorbed by clamping `..` at
 * the root, so nothing ever looked wrong. These pin the paths themselves.
 */

describe("relativeImport", () => {
  it("keeps a root-level target inside the project", () => {
    expect(relativeImport("/App.tsx", "/app/page.tsx")).toBe("./app/page.tsx");
  });

  it("keeps a nested target beside its sibling", () => {
    expect(relativeImport("/components/ui/button.tsx", "/components/ui/badge.tsx")).toBe("./badge.tsx");
  });

  it("climbs out of one directory, not two", () => {
    expect(relativeImport("/app/page.tsx", "/components/ui/button.tsx")).toBe(
      "../components/ui/button.tsx"
    );
  });

  it("climbs two directories from a component", () => {
    expect(relativeImport("/components/ui/button.tsx", "/lib/utils.ts")).toBe("../../lib/utils.ts");
  });

  it("reaches a block's page from the entry", () => {
    expect(relativeImport("/App.tsx", "/app/sidebar-07/page.tsx")).toBe("./app/sidebar-07/page.tsx");
  });

  it("has no path for a file importing itself", () => {
    expect(relativeImport("/app/page.tsx", "/app/page.tsx")).toBe("./page.tsx");
  });
});
