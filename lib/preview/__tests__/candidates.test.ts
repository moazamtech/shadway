import { describe, expect, it } from "vitest";

import { collectCandidates } from "@/lib/preview/tailwind";

/**
 * The classes that reach Tailwind, which is the whole list of utilities a
 * preview can possibly generate.
 *
 * The extractor used to skip `[` when starting a token, which ate the bracket
 * of every arbitrary variant and arbitrary property and handed Tailwind the
 * tail — `&>svg]:size-4` instead of `[&>svg]:size-4`. Tailwind dropped those
 * without a word, so a sidebar, an avatar and a hero all rendered subtly wrong
 * and no build, test or log said so. Across the vendored shadcn sources that
 * was 137 distinct utilities.
 */

function candidates(source: string): string[] {
  return collectCandidates([{ path: "/components/thing.tsx", content: source }]);
}

describe("collectCandidates", () => {
  it("reads an arbitrary variant whole", () => {
    expect(candidates('className="[&>svg]:size-4"')).toContain("[&>svg]:size-4");
  });

  it("reads an arbitrary variant that opens with a media query", () => {
    const source = 'className="[@media(min-width:900px)]:grid"';
    expect(candidates(source)).toContain("[@media(min-width:900px)]:grid");
  });

  it("reads a bare arbitrary property", () => {
    expect(candidates('className="[mask-type:luminance]"')).toContain("[mask-type:luminance]");
  });

  it("reads a data attribute variant", () => {
    expect(candidates('"*:data-[slot=avatar]:ring-2"')).toContain("*:data-[slot=avatar]:ring-2");
  });

  it("reads a compound selector variant whole", () => {
    expect(candidates('"&>[data-slot=x]:is(button,a):hover]:bg-primary/80"')).toContain(
      "&>[data-slot=x]:is(button,a):hover]:bg-primary/80"
    );
  });

  /** A mid-token `[` was always handled; this guards it against a regression. */
  it("reads an arbitrary value inside a utility", () => {
    expect(candidates("grid-cols-[repeat(auto-fit,minmax(0,1fr))]")).toContain(
      "grid-cols-[repeat(auto-fit,minmax(0,1fr))]"
    );
  });

  it("keeps whitespace inside an arbitrary value", () => {
    expect(candidates('"content-[\'a b\']"')).toContain("content-['a b']");
  });

  it("splits a class list on whitespace", () => {
    expect(candidates('className="flex items-center gap-2"')).toEqual(
      expect.arrayContaining(["flex", "items-center", "gap-2"])
    );
  });

  it("does not swallow a class list into the className before it", () => {
    const found = candidates('cn("p-4", "text-sm")');
    expect(found).toContain("p-4");
    expect(found).toContain("text-sm");
    // `cn(` itself is emitted and then ignored by Tailwind; what must not happen
    // is the classes riding along inside it, which is what a quote that failed
    // to end the candidate used to cause.
    expect(found.filter((token) => token.includes("cn("))).toEqual(["cn("]);
  });

  it("reads the shadcn selector variants the design system is built on", () => {
    const source = [
      'cn("bg-background [&_p]:leading-relaxed")',
      'cn("[&_p]:leading-relaxed")',
      'cn("[&>svg]:size-4")',
      'cn("data-[state=open]:animate-in")',
    ].join("\n");

    const found = candidates(source);
    expect(found).toEqual(
      expect.arrayContaining([
        "[&_p]:leading-relaxed",
        "[&>svg]:size-4",
        "data-[state=open]:animate-in",
      ])
    );
  });

  it("does not read a stylesheet's imports", () => {
    const found = collectCandidates([
      { path: "/app/globals.css", content: '@import "tailwindcss";' },
    ]);
    expect(found).toEqual([]);
  });
});
