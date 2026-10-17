import { describe, expect, it } from "vitest";

import { hasDefaultExport, resolveEntryPage } from "@/lib/preview/entry";

/**
 * "Which file does the preview start from" used to have two answers, one in the
 * sandbox and one in the publish build, and the sandbox's answer was
 * `/app/page.tsx` or nothing. A shadcn block installs at `app/<name>/page.tsx`,
 * so the sandbox showed "Nothing to preview yet" over a project with a page in
 * it — and the publish build fell back to the alphabetically first `.tsx`,
 * which for `dashboard-01` is `components/app-sidebar.tsx`. These are the cases
 * that fall out of one shared answer.
 */

const page = (path: string, source = "export default function Page() { return null; }") => ({
  path,
  content: source,
});

describe("resolveEntryPage", () => {
  it("prefers the page the caller asked for", () => {
    const files = [page("/app/page.tsx"), page("/app/dashboard/page.tsx")];
    expect(resolveEntryPage(files, "/app/dashboard/page.tsx")).toBe("/app/dashboard/page.tsx");
  });

  it("ignores a preference for a file that is not there", () => {
    expect(resolveEntryPage([page("/app/page.tsx")], "/app/gone/page.tsx")).toBe("/app/page.tsx");
  });

  it("takes the canonical page over any other", () => {
    expect(resolveEntryPage([page("/app/dashboard/page.tsx"), page("/app/page.tsx")])).toBe(
      "/app/page.tsx"
    );
  });

  it("finds a block's own route page, shallowest first", () => {
    const files = [page("/app/dashboard/analytics/page.tsx"), page("/app/dashboard/page.tsx")];
    expect(resolveEntryPage(files)).toBe("/app/dashboard/page.tsx");
  });

  it("accepts a page inside a route group", () => {
    expect(resolveEntryPage([page("/app/(marketing)/page.tsx")])).toBe("/app/(marketing)/page.tsx");
  });

  it("falls back to a module that can stand alone, not the first one alphabetically", () => {
    const files = [
      page("/components/app-sidebar.tsx", "export function AppSidebar() { return null; }"),
      page("/components/hero.tsx"),
    ];
    // `app-sidebar` sorts first and has no default export, so rendering it
    // would fail with "No matching export … for import default".
    expect(resolveEntryPage(files)).toBe("/components/hero.tsx");
  });

  it("returns nothing for a project with no modules", () => {
    expect(resolveEntryPage([{ path: "/app/globals.css", content: "" }])).toBeNull();
  });
});

describe("hasDefaultExport", () => {
  it("sees the shapes a module actually writes", () => {
    expect(hasDefaultExport("export default function Page() {}")).toBe(true);
    expect(hasDefaultExport("export default Page;")).toBe(true);
    expect(hasDefaultExport("export { Page as default }")).toBe(true);
    expect(hasDefaultExport("const Page = () => null;\nexport default Page;")).toBe(true);
  });

  it("is not fooled by a named export", () => {
    expect(hasDefaultExport("export function ChartAreaAxes() {}")).toBe(false);
    expect(hasDefaultExport("export const description = 'x';")).toBe(false);
  });
});
