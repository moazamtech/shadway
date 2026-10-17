/**
 * Delivery-side image sizing.
 *
 * A cover is captured from a full 1200x900 render and stored untouched, which
 * means the PNG sitting behind a card can be a couple of megabytes. The card
 * paints it a few hundred pixels wide, and the detail view paints a live
 * preview instead — so requesting the original ships roughly fifty times the
 * pixels anyone looks at, on the one request a visitor waits for before the
 * feed appears.
 *
 * Cloudinary derives the size we actually asked for from the stored original,
 * which is why this lives at delivery rather than upload: records already in
 * the database get the smaller file with no re-upload, no migration and no
 * second copy in the bucket to keep in sync.
 */

/**
 * A plain Cloudinary upload URL, split into the part transformations slot into
 * and the versioned path that follows it.
 *
 * Only the untransformed form matches. A URL that already carries a
 * transformation (`.../upload/f_auto,q_auto/v123/...`) falls through and is
 * returned exactly as it is, so this can be applied at every layer without any
 * risk of stacking transformations on top of each other.
 */
const PLAIN_CLOUDINARY_UPLOAD =
  /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video)\/upload)\/(v\d+\/.+)$/;

function derive(url: string | undefined, transformation: string): string | undefined {
  if (!url) return undefined;
  const match = PLAIN_CLOUDINARY_UPLOAD.exec(url);
  if (!match) return url;
  const [, base, path] = match;
  return `${base}/${transformation}/${path}`;
}

/** The width a card cover is painted at on the widest grid the feed uses. */
export const COVER_CARD_WIDTH = 800;

/**
 * A cover at the size it is painted.
 *
 * `f_auto` lets the CDN hand back AVIF or WebP instead of the original PNG and
 * `q_auto` picks a quality that survives the round trip; `c_limit` only ever
 * shrinks, so a cover that is already small is passed through at its own size.
 */
export function coverImageUrl(url?: string, width = COVER_CARD_WIDTH) {
  return derive(url, `f_auto,q_auto,w_${width},c_limit`);
}

/**
 * The hover video, on the same footing.
 *
 * Format is left alone deliberately: the element is a plain `<video src>` with
 * no `<source>` alternatives, so `f_auto` asking the CDN to negotiate a
 * container per browser would be working against it. Quality is not.
 */
export function previewVideoUrl(url?: string) {
  return derive(url, "q_auto");
}
