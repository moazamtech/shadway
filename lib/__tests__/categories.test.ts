import { describe, expect, it } from "vitest";

import {
  CATEGORY_GROUPS,
  CATEGORY_TAGS,
  findGroup,
  findTag,
  groupForTag,
  normalizeGroup,
  registryTypeFor,
  tagTitle,
  tagsInGroup,
} from "@/lib/categories";
import { shadcnRegistrySlug } from "@/lib/registry/parsers";
import { REGISTRY_ITEM_TYPES } from "@/lib/registry/types";

/**
 * The one list a component's category can come from.
 *
 * Before it, five places each held their own list — the publish form, two admin
 * forms, the public submit form, the collections page — and none agreed with
 * another. Worse, the registry item took its `type` straight from that free
 * text, so a component filed under `hero` shipped a type the shadcn CLI does
 * not accept.
 */

describe("the taxonomy", () => {
  it("has exactly the two groups, and each is a valid registry type", () => {
    expect(CATEGORY_GROUPS.map((group) => group.slug)).toEqual(["ui", "marketing"]);
    for (const group of CATEGORY_GROUPS) {
      expect(["registry:ui", "registry:block"]).toContain(group.registryType);
    }
  });

  it("gives every tag a unique slug and a group", () => {
    const slugs = CATEGORY_TAGS.map((tag) => tag.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    for (const tag of CATEGORY_TAGS) {
      expect(findGroup(tag.group), `${tag.slug} -> ${tag.group}`).not.toBeNull();
    }
  });

  it("keeps every tag out of the database's vocabulary of bare words", () => {
    // A tag is a slug, never a display word: it has to survive a URL and a
    // Mongo exact-match filter unchanged.
    for (const tag of CATEGORY_TAGS) {
      expect(tag.slug, tag.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("puts the whole taxonomy in the two groups", () => {
    expect(tagsInGroup("ui").length + tagsInGroup("marketing").length).toBe(
      CATEGORY_TAGS.length
    );
  });
});

describe("normalizeGroup", () => {
  it("leaves a group alone", () => {
    expect(normalizeGroup("ui")).toBe("ui");
    expect(normalizeGroup("marketing")).toBe("marketing");
    expect(normalizeGroup("  Marketing ")).toBe("marketing");
  });

  /**
   * Every component already in the database was filed under one of the ad-hoc
   * lists, so this is what keeps them all working after the taxonomy landed.
   */
  it("reads the values the old ad-hoc lists used", () => {
    expect(normalizeGroup("hero")).toBe("marketing");
    expect(normalizeGroup("block")).toBe("marketing");
    expect(normalizeGroup("footer")).toBe("marketing");
    expect(normalizeGroup("pricing")).toBe("marketing");

    expect(normalizeGroup("animation")).toBe("ui");
    expect(normalizeGroup("form")).toBe("ui");
    expect(normalizeGroup("data")).toBe("ui");
    expect(normalizeGroup("general")).toBe("ui");
  });

  it("has a group for anything at all", () => {
    expect(normalizeGroup("something-nobody-has-used")).toBe("ui");
    expect(normalizeGroup("")).toBe("ui");
    expect(normalizeGroup(null)).toBe("ui");
  });
});

describe("tagTitle", () => {
  it("reads a tag we know", () => {
    expect(tagTitle("pricing-section")).toBe("Pricing Sections");
    expect(tagTitle("modal-dialog")).toBe("Dialogs / Modals");
  });

  it("never renders blank for a tag we do not", () => {
    expect(tagTitle("something-new")).toBe("Something New");
    expect(tagTitle("")).toBe("Uncategorized");
  });
});

describe("groupForTag", () => {
  it("places a known tag", () => {
    expect(groupForTag("hero")).toBe("marketing");
    expect(groupForTag("button")).toBe("ui");
  });

  it("falls back to the group rules for a tag we do not", () => {
    expect(groupForTag("pricing")).toBe("marketing");
    expect(groupForTag("whatever")).toBe("ui");
  });
});

/**
 * The defect this file exists to close.
 *
 * `registry:${category}` produced `"type": "registry:hero"` — a type the shadcn
 * CLI does not accept. It built, it served, and `shadcn add` had nothing to
 * install, so the only way to find out was to try it.
 *
 * The list this used to carry inline is the same duplication that caused the
 * bug: it had already rotted. It listed `registry:example`, which the
 * published schema no longer includes, and omitted `registry:component`, the
 * type of every file in every item this registry serves. It is now
 * `REGISTRY_ITEM_TYPES` — one list, with one owner.
 *
 * That does make this test agree with the module it checks, which is normally
 * the wrong shape for a test. It is the right shape here because this test
 * asks a different question from `lib/registry/__tests__/item.test.ts`: that one
 * audits a built item against the schema transcribed by hand, and is the
 * independent oracle. This one only asks that the mapper returns *a* type the
 * schema allows.
 */
describe("shadcnRegistrySlug", () => {
  it("only ever returns a type the CLI accepts", () => {
    for (const value of [
      "ui",
      "marketing",
      "hero",
      "block",
      "footer",
      "pricing",
      "animation",
      "form",
      "data",
      "general",
      "hooks",
      "blocks",
      "icons",
      "lib",
      "utils",
      "example",
      "examples",
      "anything-at-all",
      "",
    ]) {
      expect(REGISTRY_ITEM_TYPES, value).toContain(shadcnRegistrySlug(value));
    }
  });

  it("maps a section to a block", () => {
    expect(shadcnRegistrySlug("hero")).toBe("registry:block");
    expect(shadcnRegistrySlug("pricing")).toBe("registry:block");
    expect(shadcnRegistrySlug("marketing")).toBe("registry:block");
  });

  it("maps a component to a ui", () => {
    expect(shadcnRegistrySlug("ui")).toBe("registry:ui");
    expect(shadcnRegistrySlug("animation")).toBe("registry:ui");
  });

  it("still honours the kinds the CLI names directly", () => {
    expect(shadcnRegistrySlug("hooks")).toBe("registry:hook");
    expect(shadcnRegistrySlug("blocks")).toBe("registry:block");
    expect(shadcnRegistrySlug("icons")).toBe("registry:ui");
  });

  /**
   * `registry:example` is a legacy type the CLI's runtime schema still tolerates
   * but the published schema — the one our `$schema` points at — does not list,
   * so an item declaring it is invalid by the contract it claims to satisfy.
   */
  it("never returns registry:example", () => {
    expect(shadcnRegistrySlug("example")).toBe("registry:component");
    expect(shadcnRegistrySlug("examples")).toBe("registry:component");
    expect(REGISTRY_ITEM_TYPES).not.toContain("registry:example");
  });
});

describe("registryTypeFor", () => {
  /**
   * This is the branch that produced `"type": "registry:hero"`. Whatever a
   * component is filed under, the answer is one of exactly two values, and the
   * legacy value that decides which is spelled out below.
   */
  it("is closed: every input, known or not, is a ui or a block", () => {
    for (const value of [
      "ui",
      "marketing",
      "hero",
      "block",
      "hooks",
      "lib",
      "utils",
      "example",
      "animation",
      "form",
      "data",
      "general",
      "",
      "   ",
      null,
      undefined,
      "something-nobody-has-used",
    ]) {
      expect(["registry:ui", "registry:block"], String(value)).toContain(registryTypeFor(value));
    }
  });

  it("reads a section as a block and a component as a ui", () => {
    expect(registryTypeFor("hero")).toBe("registry:block");
    expect(registryTypeFor("pricing")).toBe("registry:block");
    expect(registryTypeFor("animation")).toBe("registry:ui");
    expect(registryTypeFor("ui")).toBe("registry:ui");
  });
});

describe("findTag", () => {
  it("is case- and space-insensitive", () => {
    expect(findTag(" Button ")?.title).toBe("Buttons");
    expect(findTag("no-such-tag")).toBeNull();
  });
});
