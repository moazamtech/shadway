/**
 * The rules a component's registry URL follows.
 *
 * ## Why this file exists
 *
 * A component's slug is its permanent address: it is the `/r/<slug>` a stranger
 * runs `npx shadcn add` against and the `/c/<slug>` they read. Three problems
 * with how it used to be handled:
 *
 * 1. **It could not be chosen.** The slug was minted once from the draft's
 *    title, in a route the author never sees, and the publish panel showed the
 *    result as read-only text — so a component named "Untitled component" at the
 *    moment of its birth kept `untitled-component` forever, and there was no way
 *    to fix it except renaming the whole document.
 * 2. **The validation could not be shared.** `slugify` and `isValidSlug` live
 *    in `lib/db/components.ts`, which imports `mongodb` at the top. A client
 *    component cannot import them, so the publish panel re-implemented the
 *    slugifier inline — and the copy diverged: no `.trim()`, no length cap, and
 *    a hyphen-stripping regex that only ran once.
 * 3. **A rename created a second component.** `POST /api/components` used the
 *    submitted slug to *find* the existing record. A slug that did not match
 *    found nothing, so the update fell through to the create path and the
 *    original draft was orphaned beside its replacement.
 *
 * So the rules live here, with nothing in them but rules, and both the server
 * and the form can hold a slug to them.
 */

/** Lowercase, hyphen-separated, no leading or trailing or doubled hyphen. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 80;

/**
 * Paths the app already serves.
 *
 * `/r/<slug>` and `/c/<slug>` are catch-alls, so nothing *routes* wrong — but a
 * component addressed at `/c/api` or `/c/studio` is a link that reads as a
 * section of the site rather than a component, and one that goes stale the
 * moment a route is added. The next first segment after the two catch-alls is
 * what a slug can collide with, so that is the list.
 */
const RESERVED = new Set([
  "about",
  "account",
  "admin",
  "api",
  "app",
  "auth",
  "bookmarks",
  "c",
  "collections",
  "components",
  "database",
  "databases",
  "directory",
  "docs",
  "feed",
  "home",
  "landing",
  "login",
  "new",
  "preview",
  "privacy",
  "profile",
  "r",
  "register",
  "registry",
  "search",
  "settings",
  "signin",
  "signup",
  "site",
  "sitemap",
  "studio",
  "submit",
  "support",
  "terms",
  "u",
  "vibecode",
  "website",
]);

/**
 * What a free-typed title becomes.
 *
 * Deliberately idempotent: `slugify(slugify(x)) === slugify(x)`, so feeding a
 * slug back through it cannot change it. That is what lets the form re-derive a
 * preview from the author's edits without ever disagreeing with the server.
 */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    /**
     * Truncation can leave a trailing hyphen, which `SLUG_PATTERN` rejects —
     * and a slug the form is showing but the server refuses is the exact class
     * of disagreement this file exists to remove.
     */
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && slug.length >= SLUG_MIN_LENGTH && slug.length <= SLUG_MAX_LENGTH;
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug.toLowerCase());
}

export type SlugProblem =
  | "empty"
  | "too-short"
  | "too-long"
  | "characters"
  | "reserved"
  | "available";

/**
 * Why a slug cannot be used, or `"available"`.
 *
 * The form shows the same sentence the server would have refused with, so the
 * two never disagree about whether a URL is fine.
 */
export function slugProblem(
  slug: string,
  options: { taken?: readonly string[]; current?: string } = {}
): SlugProblem {
  const value = slug.trim();

  if (!value) return "empty";
  if (value.length < SLUG_MIN_LENGTH) return "too-short";
  if (value.length > SLUG_MAX_LENGTH) return "too-long";
  if (!SLUG_PATTERN.test(value)) return "characters";
  if (isReservedSlug(value)) return "reserved";
  if (options.taken && options.current && value !== options.current && options.taken.includes(value)) {
    return "reserved";
  }

  return "available";
}

/** The sentence for a problem, or null when the slug is usable. */
export function slugMessage(problem: SlugProblem): string | null {
  switch (problem) {
    case "available":
      return null;
    case "empty":
      return "Pick a URL for this component.";
    case "too-short":
      return `At least ${SLUG_MIN_LENGTH} characters.`;
    case "too-long":
      return `At most ${SLUG_MAX_LENGTH} characters.`;
    case "characters":
      return "Lowercase letters, numbers and single hyphens only.";
    case "reserved":
      return "That URL is already taken.";
  }
}
