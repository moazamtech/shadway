import { describe, expect, it } from "vitest";

import { DEFAULT_FONT_NAMES as PUBLISHED } from "@/lib/preview/build";
import { DEFAULT_FONT_NAMES as SANDBOX } from "@/lib/studio/sandpack";

/**
 * The two font lists have to agree, and nothing held them to each other.
 *
 * `next/font/google` exports one binding per Google font and there are thousands
 * of them, so both builds generate a project's font modules from the project's
 * own imports *and* fall back to a floor of names that are worth having whether
 * or not an import statement spells them out. There were two floors, written
 * separately, and a comment in `lib/preview/build.ts` claimed this file kept
 * them equal — a claim that was false, because the file did not exist.
 *
 * The failure that hides there is asymmetric and ugly to debug: a component
 * importing a font in the floor renders in the sandbox and throws
 * `export 'X' was not found` in the published document, or the reverse. The
 * author sees one of their two previews work and has no reason to suspect a
 * hard-coded list in a module they have never opened.
 *
 * Why two lists at all, rather than one shared import: `lib/studio` is the
 * browser-side sandbox and `lib/preview` is the server-side build, and neither
 * imports the other today. Making them share a module to share a string array
 * would be a real dependency for no real gain. A test can import both, which is
 * exactly what a test is for.
 */
describe("the font floors", () => {
  it("are the same set of names", () => {
    expect([...SANDBOX].sort()).toEqual([...PUBLISHED].sort());
  });

  it("list no duplicates, so neither build emits a repeated export", () => {
    expect(new Set(SANDBOX).size).toBe(SANDBOX.length);
    expect(new Set(PUBLISHED).size).toBe(PUBLISHED.length);
  });

  /**
   * Every entry becomes `export const <name>` in generated source, so a name
   * that is not a JS identifier is a syntax error in a file nobody wrote.
   */
  it("are all valid identifiers", () => {
    for (const name of SANDBOX) {
      expect(name, name).toMatch(/^[A-Za-z_$][A-Za-z0-9_$]*$/);
    }
  });

  /**
   * The floor is a safety net, not the mechanism — a project's own imports are.
   * If it grows to the point that it is most of `next/font/google`, it is
   * costing every preview bundle for names almost nobody asks for.
   */
  it("stays a floor rather than a catalogue", () => {
    expect(SANDBOX.length).toBeLessThan(80);
  });
});
