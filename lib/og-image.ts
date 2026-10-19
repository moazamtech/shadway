/**
 * Where an og:image points, and what happens when it points nowhere.
 *
 * This used to be a dozen lines inline in `lib/seo.ts`, and a second, different
 * dozen in `lib/metadata-fetcher.ts` — the second naming a file that has never
 * existed in `public/`. Every fallback here is therefore a constant that a test
 * checks against the filesystem, because the failure this guards is invisible
 * from inside the app: the page renders, the `<meta>` tags are well-formed, and
 * the only symptom is that a share card shows no picture. Nothing in a browser
 * ever complains, so nothing catches it until someone opens the link.
 */

/** The canonical origin. Every relative asset is absolutised against this. */
export const SITE_URL = "https://shadway.online";

/**
 * The one image used when a page has none of its own.
 *
 * `/placeholder-image.jpg` is committed in `public/` at 1200x630 — the Open
 * Graph ratio, and the exact size `generateSEOMetadata` declares in the tag, so
 * the declared dimensions and the file agree.
 *
 * It is 24 KB. `/og-image.png` is the site's branded card and is 5 MB, which is
 * fine as a once-per-share download and absurd as the fallback for a card in a
 * grid of thirty, where every component without a cover pays it. So the
 * metadata fallbacks name the small one, and the two spellings — this constant
 * and `generateSEOMetadata`'s default — can no longer drift apart into a 404.
 */
export const OG_IMAGE_FALLBACK = "/placeholder-image.jpg";

/** The width and height every og:image is declared at. */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/**
 * A URL that ends in something a scraper will render.
 *
 * Scrapers fetch `og:image` directly rather than resolving it against the page,
 * so a relative path, a `data:` URI or a tracker's redirect all end the same
 * way: no card. The extension check is deliberately strict — it would rather
 * fall back to an image that is known to exist than pass along a URL that looks
 * plausible and 404s on someone else's server.
 */
const IMAGE_FILE = /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i;

/**
 * Turn an image reference into an absolute http(s) URL, or `null` if it cannot
 * be one.
 *
 * The checks are strict on purpose. `startsWith("http")` — what this replaced —
 * let three real shapes through as if they were fine:
 *
 *   - `"HTTPS://cdn/x.png"`, because the test was case-sensitive and the value
 *     became `https://shadway.online/HTTPS://cdn/x.png`.
 *   - `"//cdn.example.com/x.png"`, the protocol-relative form, which does not
 *     start with `http` and became a path on this site.
 *   - `"http-banner.png"`, which starts with `http` and was accepted as though
 *     it were already absolute.
 *
 * `data:` and `blob:` are rejected outright. They are not fetchable by a
 * scraper, and prefixing them with the origin produces a URL that looks
 * absolute and resolves to nothing.
 */
export function absolutiseImageUrl(
  image: string | null | undefined,
  baseUrl: string = SITE_URL,
): string | null {
  if (typeof image !== "string") return null;
  const value = image.trim();
  if (!value) return null;

  // Protocol-relative: "//host/x.png". Adopt the origin's scheme rather than
  // treating the host as a path segment.
  const candidate = value.startsWith("//") ? `https:${value}` : value;

  // Anything that parses as an absolute URL is taken at its word, then checked
  // for the scheme we can actually publish.
  if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    try {
      const parsed = new URL(candidate);
      return parsed.protocol === "http:" || parsed.protocol === "https:"
        ? parsed.toString()
        : null;
    } catch {
      return null;
    }
  }

  // Otherwise it is a path on this site. Collapse a leading slash so a bare
  // name and a rooted path cannot produce a doubled separator.
  return new URL(`${baseUrl}/${candidate.replace(/^\/+/, "")}`).toString();
}

/**
 * The absolute image URL to put in the og:image tag, or the fallback.
 *
 * Every path through this function ends at a URL that a scraper can fetch:
 * either the page's own image, or `OG_IMAGE_FALLBACK` against `baseUrl`. The
 * returned value is never relative, because a relative og:image is discarded by
 * every scraper that matters — Slack, X and Discord included — and the share
 * silently loses its picture.
 */
export function resolveOgImage(
  image: string | null | undefined,
  baseUrl: string = SITE_URL,
): string {
  const absolute = absolutiseImageUrl(image, baseUrl);

  if (!absolute || !IMAGE_FILE.test(absolute)) {
    return absolutiseImageUrl(OG_IMAGE_FALLBACK, baseUrl) as string;
  }

  return absolute;
}