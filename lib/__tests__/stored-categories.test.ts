import { describe, expect, it } from "vitest";

import {
  findGroup,
  normalizeGroup,
  registryTypeFor,
  storedCategoriesFor,
} from "@/lib/categories";

/**
 * The query side of the taxonomy.
 *
 * `normalizeGroup` was added so a component filed under an old ad-hoc name still
 * lands in the right bucket — but only in the places that were rewritten. The
 * feed query was not one of them: it compared the incoming category against the
 * stored string literally. So the sidebar linked to `?category=marketing`, the
 * header counted the components that matched it, and the grid below came back
 * empty — because nothing is *stored* as `marketing`. Every component published
 * before the taxonomy existed is stored as `block`, or `hero`, or `pricing`.
 *
 * These tests hold the two halves together: every name in a group's equivalence
 * class must appear in the list the query expands to, or it is invisible.
 */

describe("storedCategoriesFor", () => {
  it("includes every legacy name that resolves to the group", () => {
    for (const legacy of ["block", "hero", "pricing", "footer", "marketing"]) {
      expect(storedCategoriesFor("marketing"), legacy).toContain(legacy);
    }
    for (const legacy of ["animation", "form", "data", "general", "icons"]) {
      expect(storedCategoriesFor("ui"), legacy).toContain(legacy);
    }
  });

  it("includes the canonical slug itself", () => {
    expect(storedCategoriesFor("marketing")).toContain("marketing");
    expect(storedCategoriesFor("ui")).toContain("ui");
  });

  /** The failure that shipped: the grid came back empty while the count did not. */
  it("makes every stored value findable through its group", () => {
    const stored = [
      "ui", "block", "hero", "pricing", "footer", "about", "feature", "features",
      "contact", "animation", "form", "data", "general", "icons", "blocks",
      "marketing", "hooks",
    ];

    for (const value of stored) {
      const group = normalizeGroup(value);
      expect(storedCategoriesFor(group), value).toContain(value);
    }
  });

  it("never mixes the two groups", () => {
    const ui = storedCategoriesFor("ui");
    const marketing = storedCategoriesFor("marketing");

    expect(ui.some((v) => marketing.includes(v))).toBe(false);
  });

  it("accepts a legacy name and answers with its group", () => {
    // A deep link written before the taxonomy — `?category=hero`.
    expect(storedCategoriesFor("hero").sort()).toEqual(
      storedCategoriesFor("marketing").sort()
    );
  });

  it("falls back to the UI group for anything unrecognised", () => {
    // `normalizeGroup` sends nonsense to `ui`, so the query must too or the
    // sidebar's own `?category=` link would return nothing at all.
    expect(storedCategoriesFor("nonsense")).toEqual(storedCategoriesFor("ui"));
  });

  it("is empty-proof: never returns an empty list for a real group", () => {
    for (const group of ["ui", "marketing"]) {
      expect(storedCategoriesFor(group).length).toBeGreaterThan(0);
    }
  });
});

describe("the two halves still agree", () => {
  /** The inverse property: everything the query returns really is that group. */
  it("every name it returns normalizes back to the group asked for", () => {
    for (const group of ["ui", "marketing"]) {
      for (const value of storedCategoriesFor(group)) {
        expect(normalizeGroup(value), `${group} -> ${value}`).toBe(group);
      }
    }
  });

  it("the canonical group slug is a real group", () => {
    for (const group of ["ui", "marketing"]) {
      expect(findGroup(group), group).not.toBeNull();
      expect(registryTypeFor(group)).toBe(
        group === "ui" ? "registry:ui" : "registry:block"
      );
    }
  });
});