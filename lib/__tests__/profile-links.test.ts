import { describe, expect, it } from "vitest";

import {
  MAX_BIO_LENGTH,
  MAX_LINK_LENGTH,
  PROFILE_TEXT_FIELDS,
  normalizeBio,
  normalizeGithub,
  normalizeProfileField,
  normalizeTwitter,
  normalizeWebsite,
} from "@/lib/profile-links";

/**
 * The links on a public profile.
 *
 * `resolveProfile()` has always read `website`, `twitter` and `github` off the
 * user document, and the profile page renders each one as the `href` of a
 * `<Link target="_blank">`. Nothing wrote them, so every profile showed three
 * empty slots — and the field was one form away from being a stored-XSS hole:
 * an `href` is not escaped against a `javascript:` URL, so an unchecked value
 * fires in the reader's own origin on every profile page that cached it.
 *
 * So the rules are pinned here, in one module the form and the route both
 * import. The day these two implementations drift, the failure is not an error
 * message: it is a profile link that quietly points somewhere it should not,
 * which is the same silence that let these fields sit unset in the first place.
 */

describe("normalizeWebsite", () => {
  it("adds https:// to a bare host", () => {
    expect(normalizeWebsite("example.com")).toEqual({
      ok: true,
      value: "https://example.com/",
    });
    expect(normalizeWebsite("example.com/work")).toEqual({
      ok: true,
      value: "https://example.com/work",
    });
    expect(normalizeWebsite("  Example.COM  ")).toEqual({
      ok: true,
      value: "https://example.com/",
    });
  });

  /**
   * The whole reason this file exists. `new URL` accepts `javascript:alert(1)`
   * and hands back a perfectly good URL object for it, so "the parser took it"
   * is not evidence that it is a link.
   */
  it("refuses a javascript: URL", () => {
    const result = normalizeWebsite("javascript:alert(document.cookie)");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problem).toBe("scheme");
  });

  it("refuses every other scheme", () => {
    for (const value of [
      "data:text/html,<script>alert(1)</script>",
      "mailto:ada@example.com",
      "ftp://example.com",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
    ]) {
      expect(normalizeWebsite(value).ok, value).toBe(false);
    }
  });

  /**
   * A scheme that is not a scheme. `example.com:8080/x` trips every naive
   * "does it contain a colon" check, and refusing it would send the author off
   * to report a bug for a link that is fine.
   */
  it("keeps a host and port", () => {
    expect(normalizeWebsite("example.com:8080/work")).toEqual({
      ok: true,
      value: "https://example.com:8080/work",
    });
  });

  it("keeps http when that is what was typed", () => {
    expect(normalizeWebsite("http://example.com")).toEqual({
      ok: true,
      value: "http://example.com/",
    });
    expect(normalizeWebsite("HTTP://Example.com")).toEqual({
      ok: true,
      value: "http://example.com/",
    });
  });

  it("refuses something with no host to speak of", () => {
    for (const value of ["https://", "not a url", "example", "https://localhost"]) {
      expect(normalizeWebsite(value).ok, value).toBe(false);
    }
  });

  it("treats an empty value as clearing the field", () => {
    expect(normalizeWebsite("")).toEqual({ ok: true, value: "" });
    expect(normalizeWebsite("   ")).toEqual({ ok: true, value: "" });
  });

  it("refuses anything that is not text", () => {
    for (const value of [42, null, undefined, { href: "https://x.com" }, ["https://x.com"]]) {
      const result = normalizeWebsite(value);
      expect(result.ok, String(value)).toBe(false);
      if (!result.ok) expect(result.problem).toBe("type");
    }
  });

  it("refuses a link longer than any homepage", () => {
    expect(normalizeWebsite(`https://example.com/${"a".repeat(MAX_LINK_LENGTH)}`).ok).toBe(false);
  });

  /**
   * Idempotent, because the form re-derives the preview from the author's
   * typing on every keystroke and then adopts whatever the server echoes back.
   * A normaliser that moved its own output would make the field fight the
   * person filling it in.
   */
  it("is idempotent", () => {
    for (const value of [
      "example.com",
      "example.com:8080/work",
      "http://Example.com/a?b=1#c",
      "  example.com  ",
    ]) {
      const once = normalizeWebsite(value);
      expect(once.ok, value).toBe(true);
      if (once.ok) expect(normalizeWebsite(once.value).ok, value).toBe(true);
      if (once.ok) {
        const twice = normalizeWebsite(once.value);
        if (twice.ok) expect(twice.value).toBe(once.value);
      }
    }
  });
});

describe("normalizeGithub", () => {
  it("takes all three shapes to one canonical URL", () => {
    const expected = { ok: true, value: "https://github.com/ada" };
    expect(normalizeGithub("github.com/ada")).toEqual(expected);
    expect(normalizeGithub("@ada")).toEqual(expected);
    expect(normalizeGithub("ada")).toEqual(expected);
    expect(normalizeGithub("https://github.com/ada")).toEqual(expected);
    expect(normalizeGithub("https://github.com/ada/")).toEqual(expected);
    expect(normalizeGithub("  HTTPS://GitHub.com/ada  ")).toEqual(expected);
  });

  it("lowercases the login so the field is a key, not a spelling", () => {
    expect(normalizeGithub("@AdaLovelace")).toEqual({
      ok: true,
      value: "https://github.com/adalovelace",
    });
  });

  it("refuses a profile on some other host", () => {
    for (const value of ["https://gitlab.com/ada", "https://ada.github.io", "notgithub.com/ada"]) {
      expect(normalizeGithub(value).ok, value).toBe(false);
    }
  });

  it("refuses a repository or a collection in place of a profile", () => {
    for (const value of [
      "github.com/ada/shadway",
      "https://github.com/orgs/shadway",
      "https://github.com/",
    ]) {
      expect(normalizeGithub(value).ok, value).toBe(false);
    }
  });

  it("still refuses a dangerous URL typed into this field", () => {
    expect(normalizeGithub("javascript:alert(1)").ok).toBe(false);
    expect(normalizeGithub("@has spaces").ok).toBe(false);
  });
});

describe("normalizeTwitter", () => {
  it("takes handle, @handle and profile URL to one canonical URL", () => {
    const expected = { ok: true, value: "https://x.com/ada" };
    expect(normalizeTwitter("ada")).toEqual(expected);
    expect(normalizeTwitter("@ada")).toEqual(expected);
    expect(normalizeTwitter("x.com/ada")).toEqual(expected);
    expect(normalizeTwitter("https://twitter.com/ada")).toEqual(expected);
    expect(normalizeTwitter("https://x.com/ada/")).toEqual(expected);
  });

  it("refuses a post in place of a profile", () => {
    expect(normalizeTwitter("https://x.com/ada/status/123").ok).toBe(false);
  });

  it("refuses a handle that could not be one", () => {
    for (const value of ["@way-too-long-for-a-handle-here", "@has spaces", "@bad-handle"]) {
      expect(normalizeTwitter(value).ok, value).toBe(false);
    }
  });

  it("still refuses a dangerous URL typed into this field", () => {
    expect(normalizeTwitter("javascript:alert(1)").ok).toBe(false);
  });
});

describe("normalizeBio", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeBio("  ships   UI\n\nlibraries  ")).toEqual({
      ok: true,
      value: "ships UI libraries",
    });
  });

  it("cuts at the cap the profile is laid out for", () => {
    const result = normalizeBio("a".repeat(MAX_BIO_LENGTH + 50));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(MAX_BIO_LENGTH);
  });

  it("clears on empty", () => {
    expect(normalizeBio("  ")).toEqual({ ok: true, value: "" });
  });
});

describe("normalizeProfileField", () => {
  it("routes every owned field to its own rule", () => {
    expect(normalizeProfileField("bio", "hi")).toEqual({ ok: true, value: "hi" });
    expect(normalizeProfileField("website", "example.com").ok).toBe(true);
    expect(normalizeProfileField("twitter", "@ada").ok).toBe(true);
    expect(normalizeProfileField("github", "@ada").ok).toBe(true);
  });

  /**
   * The mass-assignment surface, pinned as a list rather than as an
   * instruction. `PATCH /api/profile` walks this array and reads nothing else
   * off the request body, so a field that is not in it cannot be written at
   * all — and adding one here is a deliberate, reviewable act rather than
   * somebody remembering a denylist.
   */
  it("owns nothing that could escalate an account", () => {
    expect([...PROFILE_TEXT_FIELDS].sort()).toEqual([
      "bio",
      "github",
      "twitter",
      "website",
    ]);
    for (const field of ["role", "email", "_id", "username", "password"]) {
      expect(
        (PROFILE_TEXT_FIELDS as readonly string[]).includes(field),
        field,
      ).toBe(false);
    }
  });
});