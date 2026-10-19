import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  OG_IMAGE_FALLBACK,
  OG_IMAGE_SIZE,
  SITE_URL,
  absolutiseImageUrl,
  resolveOgImage,
} from "@/lib/og-image";

/**
 * What ends up in an `og:image`, and what happens when the value it was given
 * is not one.
 *
 * This logic was a dozen lines inline in `lib/seo.ts` and a different dozen in
 * `lib/metadata-fetcher.ts`, and the two had already parted company: the second
 * named `/placeholder-image.jpg`, which was not in `public/` and never had been.
 * Nothing failed. The page rendered, the tags were well-formed, and the only
 * symptom was a share card with no picture — which is indistinguishable, to
 * everyone involved, from having no card at all.
 */

/** A scraper fetches og:image directly; it does not resolve it against the page. */
const isAbsolute = (value: string) => /^https?:\/\//.test(value);

describe("absolutiseImageUrl", () => {
  it("leaves an absolute URL alone", () => {
    expect(absolutiseImageUrl("https://res.cloudinary.com/shadway/x.jpg")).toBe(
      "https://res.cloudinary.com/shadway/x.jpg",
    );
    expect(absolutiseImageUrl("http://example.com/x.png")).toBe(
      "http://example.com/x.png",
    );
  });

  /**
   * Root-relative and bare names are the same file on this site.
   *
   * `startsWith("http")` used to be the whole test, so `"//cdn.example.com/x.png"`
   * — the protocol-relative form, which a CMS hands out routinely — was treated
   * as a path and rewritten to `https://shadway.online//cdn.example.com/x.png`.
   */
  it("resolves a protocol-relative URL against the site's scheme", () => {
    expect(absolutiseImageUrl("//cdn.example.com/x.png")).toBe(
      "https://cdn.example.com/x.png",
    );
  });

  it("puts a root-relative path on the origin without doubling the slash", () => {
    expect(absolutiseImageUrl("/logos/66b3e58387f7cb984dde9eb7_92.png")).toBe(
      `${SITE_URL}/logos/66b3e58387f7cb984dde9eb7_92.png`,
    );
  });

  it("puts a bare name on the origin", () => {
    expect(absolutiseImageUrl("og-image.png")).toBe(`${SITE_URL}/og-image.png`);
  });

  /**
   * The scheme test was case-sensitive, so an uppercase `HTTPS://` — which is
   * legal and which CDNs emit — was rewritten into a path on this site.
   */
  it("recognises a scheme whatever case it is written in", () => {
    expect(absolutiseImageUrl("HTTPS://CDN.EXAMPLE.COM/x.png")).toBe(
      "https://cdn.example.com/x.png",
    );
  });

  /**
   * `startsWith("http")` also accepted `"http-banner.png"` as already absolute.
   * It is a filename, and it belongs on this site.
   */
  it("does not mistake a filename beginning with http for a host", () => {
    expect(absolutiseImageUrl("http-banner.png")).toBe(`${SITE_URL}/http-banner.png`);
  });

  /**
   * A `data:` URI is not fetchable by a scraper, and prefixing it with the
   * origin produces something that looks absolute and resolves to nothing.
   */
  it("refuses a scheme that cannot be published", () => {
    expect(absolutiseImageUrl("data:image/png;base64,iVBORw0KGgo=")).toBeNull();
    expect(absolutiseImageUrl("blob:https://example.com/9f2c")).toBeNull();
    expect(absolutiseImageUrl("javascript:alert(1)")).toBeNull();
  });

  /** `website.image` is typed `string` but is initialised to `""` in the admin forms. */
  it("refuses nothing at all", () => {
    expect(absolutiseImageUrl("")).toBeNull();
    expect(absolutiseImageUrl("   ")).toBeNull();
    expect(absolutiseImageUrl(null)).toBeNull();
    expect(absolutiseImageUrl(undefined)).toBeNull();
  });

  it("respects a base URL other than the site's own", () => {
    expect(absolutiseImageUrl("/x.png", "https://staging.example.com")).toBe(
      "https://staging.example.com/x.png",
    );
  });
});

describe("resolveOgImage", () => {
  it("returns the page's own image when it is a real one", () => {
    expect(resolveOgImage("https://res.cloudinary.com/shadway/cover.png")).toBe(
      "https://res.cloudinary.com/shadway/cover.png",
    );
    expect(resolveOgImage("/logos/shadcn.jpg")).toBe(`${SITE_URL}/logos/shadcn.jpg`);
  });

  /**
   * A cache-busting query sits after the extension and must survive — dropping
   * it would hand the scraper a different URL than the one that was stored.
   */
  it("keeps a query string that follows the extension", () => {
    expect(resolveOgImage("https://cdn.example.com/x.png?v=2")).toBe(
      "https://cdn.example.com/x.png?v=2",
    );
  });

  /**
   * Every path through this function has to end at something fetchable. A
   * missing cover on a shared component is the common case, not the exotic one.
   */
  it("falls back to a committed asset when there is no usable image", () => {
    for (const missing of [undefined, null, "", "   ", "not-an-image", "/"]) {
      const resolved = resolveOgImage(missing);
      expect(isAbsolute(resolved), String(missing)).toBe(true);
      expect(resolved, String(missing)).toBe(`${SITE_URL}${OG_IMAGE_FALLBACK}`);
    }
  });

  it("falls back rather than pass on a relative path", () => {
    // A relative og:image is discarded by every scraper that matters.
    expect(isAbsolute(resolveOgImage("covers/hero"))).toBe(true);
  });

  it("never returns a relative URL for any input", () => {
    for (const input of ["", "/a.png", "a.png", "//a.png", "data:image/png;base64,x", "HTTP://A.PNG"]) {
      expect(isAbsolute(resolveOgImage(input)), input).toBe(true);
    }
  });
});

describe("the assets these constants name", () => {
  /**
   * The whole bug class this module exists for: a URL that is well-formed,
   * absolute, and points at a file nobody ever committed. Only the filesystem
   * can catch that, so the check reads the filesystem.
   */
  it("resolves the fallback to a file that is on disk", () => {
    expect(OG_IMAGE_FALLBACK.startsWith("/")).toBe(true);
    expect(
      existsSync(path.join(process.cwd(), "public", OG_IMAGE_FALLBACK)),
      `public${OG_IMAGE_FALLBACK} is missing`,
    ).toBe(true);
  });

  /** A declared size the file does not have crops the mark off the card. */
  it("declares the Open Graph ratio the placeholder was drawn at", () => {
    expect(OG_IMAGE_SIZE).toEqual({ width: 1200, height: 630 });
  });
});