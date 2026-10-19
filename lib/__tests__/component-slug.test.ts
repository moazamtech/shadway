import { describe, expect, it } from "vitest";

import {
  isReservedSlug,
  isValidSlug,
  slugMessage,
  slugProblem,
  slugify,
  SLUG_MAX_LENGTH,
} from "@/lib/component-slug";

/**
 * The rules a component's permanent address follows.
 *
 * These used to live in a module that opens a Mongo connection at the top, so
 * the publish panel — which has to tell an author whether their URL is usable
 * before they submit it — could not reach them and re-implemented the slugifier
 * inline. The two copies drifted, and a slug the form showed as fine could be
 * one the server refused. Both now import the same thing, and these tests are
 * what keeps the sentence under the input and the server's refusal the same.
 */

describe("slugify", () => {
  it("makes a title into an address", () => {
    expect(slugify("Animated Gradient Button")).toBe("animated-gradient-button");
    expect(slugify("Pricing / Table")).toBe("pricing-table");
    expect(slugify("  Hero  ")).toBe("hero");
    expect(slugify("CTA v2 (final)")).toBe("cta-v2-final");
  });

  /**
   * Idempotent, because the form re-derives a suggestion from the author's own
   * typing on every keystroke. A slugifier that moved its own output would make
   * the field fight the author.
   */
  it("is idempotent", () => {
    for (const title of ["Animated Gradient Button", "Pricing / Table", "CTA v2"]) {
      const once = slugify(title);
      expect(slugify(once)).toBe(once);
    }
  });

  it("leaves no trailing hyphen after a length cut", () => {
    const long = `${"a".repeat(SLUG_MAX_LENGTH)} tail`;
    const slug = slugify(long);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
    expect(isValidSlug(slug)).toBe(true);
  });

  it("returns nothing for nothing", () => {
    expect(slugify("")).toBe("");
    expect(slugify("!!!")).toBe("");
  });
});

describe("isValidSlug", () => {
  it("accepts a slug", () => {
    expect(isValidSlug("hero-section")).toBe(true);
    expect(isValidSlug("abc")).toBe(true);
  });

  it("refuses one that could not be a path segment", () => {
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("Hero")).toBe(false);
    expect(isValidSlug("hero_section")).toBe(false);
    expect(isValidSlug("-hero")).toBe(false);
    expect(isValidSlug("hero-")).toBe(false);
    expect(isValidSlug("hero--section")).toBe(false);
    expect(isValidSlug("hero section")).toBe(false);
    expect(isValidSlug("a".repeat(SLUG_MAX_LENGTH + 1))).toBe(false);
  });
});

describe("isReservedSlug", () => {
  it("keeps a component off a path the app already serves", () => {
    for (const slug of ["api", "admin", "studio", "r", "c", "u", "settings", "login"]) {
      expect(isReservedSlug(slug), slug).toBe(true);
    }
  });

  it("is case-insensitive", () => {
    expect(isReservedSlug("Studio")).toBe(true);
  });

  it("does not refuse a component that merely contains one", () => {
    expect(isReservedSlug("studio-ui")).toBe(false);
    expect(isReservedSlug("api-client")).toBe(false);
  });
});

describe("slugProblem", () => {
  it("says nothing when the slug is usable", () => {
    expect(slugProblem("hero-section")).toBe("available");
    expect(slugMessage("available")).toBeNull();
  });

  it("names the reason it is not", () => {
    expect(slugProblem("")).toBe("empty");
    expect(slugProblem("ab")).toBe("too-short");
    expect(slugProblem("Hero")).toBe("characters");
    expect(slugProblem("api")).toBe("reserved");
  });

  it("has a sentence for every problem", () => {
    for (const problem of ["empty", "too-short", "too-long", "characters", "reserved"] as const) {
      expect(slugMessage(problem), problem).toBeTruthy();
    }
  });

  /** A rename to your own slug is not a collision with yourself. */
  it("does not call a component's own address taken", () => {
    expect(slugProblem("hero-section", { taken: ["hero-section"], current: "hero-section" })).toBe(
      "available"
    );
  });

  it("calls another component's address taken", () => {
    expect(slugProblem("pricing-table", { taken: ["pricing-table"], current: "hero-section" })).toBe(
      "reserved"
    );
  });
});
