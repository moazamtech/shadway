/**
 * The text and links a public profile carries.
 *
 * ## Why this file exists
 *
 * `resolveProfile()` has read `website`, `twitter` and `github` off the user
 * document from the day those fields were added, and `components/profile/
 * profile-body.tsx` renders each one as the `href` of a `<Link target="_blank">`.
 * Nothing ever wrote them, so every profile in the app rendered three empty
 * slots — and the moment something *did* start writing them, the field became a
 * stored-XSS surface: an `href` is not escaped against a `javascript:` URL, so
 * one account could ship `javascript:alert(document.cookie)` and have it fire
 * off every stranger's profile page, in the origin the reader is already
 * logged into.
 *
 * The rules therefore live here, in a module with nothing in it but rules. They
 * cannot go in `lib/db/users.ts`, which imports `mongodb` at the top, because
 * the settings form has to ask the same questions before it submits — and the
 * moment the form answers them privately, the two copies drift. That drift is
 * not theoretical: it is how a value the form showed as "saves as
 * https://example.com" ends up stored as whatever the server's private copy
 * decided that string meant, with no error anywhere.
 *
 * Same shape and same reason as `lib/component-slug.ts`: rules in one place,
 * imported by both sides, pinned by tests.
 */

/** The longest bio the profile page is laid out for. */
export const MAX_BIO_LENGTH = 280;
/**
 * Longer than any real homepage. It exists so a pasted paragraph cannot turn
 * into a link long enough to be an attack surface rather than a typo.
 */
export const MAX_LINK_LENGTH = 200;

/**
 * GitHub logins are alphanumeric with hyphens; 39 is GitHub's own hard ceiling.
 * Checked against the login and not the whole URL so `github.com/ada` and `ada`
 * are held to one rule.
 */
const GITHUB_LOGIN = /^[a-z0-9](?:[a-z0-9-]{0,38})$/i;
/** X handles are 1–15 characters of letters, digits and underscore. */
const X_HANDLE = /^[a-z0-9_]{1,15}$/i;

/** Anything shaped like `scheme:` — including one that is really a host. */
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const ABSOLUTE_HTTP = /^https?:\/\//i;
/** A bare host that has a path, typed without its scheme. */
const BARE_HOST_URL = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+\//i;

export type ProfileProblem =
  | "type"
  | "scheme"
  | "malformed"
  | "host"
  | "too-long"
  | "not-github"
  | "github-login"
  | "not-x"
  | "x-handle";

/**
 * One sentence per problem, in one place. The sentence under the input and the
 * sentence the server refuses with are the same string, so an author is never
 * told a field is fine by one and broken by the other.
 */
const MESSAGES: Record<ProfileProblem, string> = {
  type: "That has to be text.",
  // Also what `javascript:`, `data:` and `mailto:` get. They are not links;
  // they are the reason this file exists.
  scheme: "Only http:// and https:// links are allowed.",
  malformed: "That does not look like a link.",
  host: "Include the whole domain, like example.com.",
  "too-long": `Keep it under ${MAX_LINK_LENGTH} characters.`,
  "not-github": "Enter a github.com profile.",
  "github-login": "Enter a GitHub username, like @ada.",
  "not-x": "Enter an x.com profile.",
  "x-handle": "Enter an X handle, like @ada.",
};

export type ProfileFieldResult =
  | { ok: true; value: string }
  | { ok: false; problem: ProfileProblem; message: string };

function fail(problem: ProfileProblem): ProfileFieldResult {
  return { ok: false, problem, message: MESSAGES[problem] };
}

function asText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Why a *link* cannot be stored.
 *
 * An empty string is always valid and always means "clear this field" — which
 * is why clearing is a value rather than a missing key, and why the route can
 * `$unset` it. The bio deliberately does not come through here: it has its own
 * cap and its own, friendlier, overflow behaviour.
 */
function commonProblem(value: unknown): ProfileProblem | "ok" | "clear" {
  const raw = asText(value);
  if (raw === null) return "type";
  const trimmed = raw.trim();
  if (!trimmed) return "clear";
  if (trimmed.length > MAX_LINK_LENGTH) return "too-long";
  return "ok";
}

type UrlParse =
  | { ok: true; url: URL }
  | { ok: false; problem: Extract<ProfileProblem, "scheme" | "malformed" | "host"> };

/**
 * Parses a web address, adding `https://` when the author left it off.
 *
 * The scheme is the whole job here. `new URL` will happily accept
 * `javascript:alert(1)` and hand back a URL object for it, so the protocol has
 * to be checked explicitly rather than inferred from "the parser took it".
 */
function parseHttpUrl(raw: string): UrlParse {
  let candidate = raw;

  if (!ABSOLUTE_HTTP.test(raw)) {
    if (raw.startsWith("//")) {
      // Protocol-relative: someone copied a link out of somewhere that hides
      // the scheme, and guessing `http` for them would be a coin flip.
      candidate = `https:${raw}`;
    } else {
      const scheme = SCHEME.exec(raw);
      /**
       * `example.com:8080/work` matches the scheme pattern too — its "scheme" is
       * just the host. A digit straight after the colon is the tell. Without
       * this, an ordinary host-and-port would be refused with "only http and
       * https are allowed", which is both wrong and unfixable by the author.
       */
      const hostAndPort = !!scheme && /^\d/.test(raw.slice(scheme[0].length));
      if (scheme && !hostAndPort) return { ok: false, problem: "scheme" };
      candidate = `https://${raw}`;
    }
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, problem: "malformed" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, problem: "scheme" };
  }
  /**
   * `new URL` accepts `https://a` and `https://localhost`, and neither is a
   * website somebody means to hand a stranger. Both are nearly always a
   * half-typed address, and refusing them is more useful than storing a link
   * that quietly goes nowhere.
   */
  if (!url.hostname.includes(".")) return { ok: false, problem: "host" };

  return { ok: true, url };
}

/**
 * The stored form of a parsed address.
 *
 * Rebuilt from the parsed parts instead of echoed from the input, so `URL` gets
 * to have already lowercased the host, folded a redundant trailing dot and
 * dropped a default port. The value that comes out compares equal to itself on
 * the next pass, which is what lets the form show a preview that is exactly
 * what gets written.
 */
function canonicalHttpUrl(url: URL): string {
  return `${url.protocol}//${url.host}${url.pathname}${url.search}${url.hash}`;
}

/** True when the text is meant to be a URL rather than a bare username. */
function looksLikeUrl(text: string): boolean {
  return text.includes("://") || text.startsWith("//") || BARE_HOST_URL.test(text);
}

/**
 * Strips the `github.com/` someone pasted instead of typing `ada`, so all
 * three shapes land in one branch and one set of rules.
 */
function stripBareHost(text: string, hosts: readonly RegExp[]): string {
  if (text.includes("://") || text.startsWith("//")) return text;
  for (const host of hosts) {
    const stripped = text.replace(host, "");
    if (stripped !== text) return stripped;
  }
  return text;
}

export function normalizeBio(value: unknown): ProfileFieldResult {
  const raw = asText(value);
  if (raw === null) return fail("type");

  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: "" };

  return {
    ok: true,
    /**
     * Newlines collapsed because the profile renders the bio as a single
     * paragraph — a bio pasted out of a README would otherwise carry four blank
     * lines into the middle of someone's identity card.
     */
    value: trimmed.replace(/\s+/g, " ").slice(0, MAX_BIO_LENGTH),
  };
}

export function normalizeWebsite(value: unknown): ProfileFieldResult {
  const common = commonProblem(value);
  if (common === "clear") return { ok: true, value: "" };
  if (common !== "ok") return fail(common);

  const parsed = parseHttpUrl((value as string).trim());
  if (!parsed.ok) return fail(parsed.problem);
  return { ok: true, value: canonicalHttpUrl(parsed.url) };
}

export function normalizeGithub(value: unknown): ProfileFieldResult {
  const common = commonProblem(value);
  if (common === "clear") return { ok: true, value: "" };
  if (common !== "ok") return fail(common);

  let text = (value as string).trim();
  // A pasted profile URL very often arrives with a trailing slash; leaving it
  // on would make the canonical form differ from the one a fresh paste gives.
  text = text.replace(/\/+$/, "");
  text = text.replace(/^@/, "");
  text = stripBareHost(text, [/^(?:www\.)?github\.com\//i]);

  if (looksLikeUrl(text)) {
    const parsed = parseHttpUrl(text);
    if (!parsed.ok) return fail(parsed.problem);
    const host = parsed.url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "github.com") return fail("not-github");
    const segments = parsed.url.pathname.split("/").filter(Boolean);
    // Only the profile itself. `github.com/ada/shadway` is a repository, and
    // storing it as somebody's identity link quietly misrepresents them.
    if (segments.length !== 1) return fail("github-login");
    text = segments[0];
  }

  if (!GITHUB_LOGIN.test(text)) return fail("github-login");
  return {
    ok: true,
    /**
     * Lowercased, not because GitHub demands it but because the field is a
     * key: two accounts that typed `Ada` and `ada` for the same person should
     * not end up with two values that look different and mean the same thing.
     */
    value: `https://github.com/${text.toLowerCase()}`,
  };
}

export function normalizeTwitter(value: unknown): ProfileFieldResult {
  const common = commonProblem(value);
  if (common === "clear") return { ok: true, value: "" };
  if (common !== "ok") return fail(common);

  let text = (value as string).trim();
  text = text.replace(/\/+$/, "");
  text = text.replace(/^@/, "");
  text = stripBareHost(text, [/^(?:www\.)?(?:x|twitter)\.com\//i]);

  if (looksLikeUrl(text)) {
    const parsed = parseHttpUrl(text);
    if (!parsed.ok) return fail(parsed.problem);
    const host = parsed.url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "x.com" && host !== "twitter.com") return fail("not-x");
    const segments = parsed.url.pathname.split("/").filter(Boolean);
    // `/i/status/123` is a post, not a profile.
    if (segments.length !== 1) return fail("x-handle");
    text = segments[0];
  }

  if (!X_HANDLE.test(text)) return fail("x-handle");
  return { ok: true, value: `https://x.com/${text.toLowerCase()}` };
}

/**
 * The fields this endpoint is allowed to write, and nothing else.
 *
 * `role`, `email`, `_id`, `username` and `password` are absent by
 * construction rather than by a filter someone might forget to extend: the
 * route walks this list and reads nothing else off the request body, so a
 * `PATCH {"role":"admin"}` has nowhere to land.
 */
export const PROFILE_TEXT_FIELDS = ["bio", "website", "twitter", "github"] as const;

export type ProfileTextField = (typeof PROFILE_TEXT_FIELDS)[number];

export function normalizeProfileField(
  field: ProfileTextField,
  value: unknown,
): ProfileFieldResult {
  switch (field) {
    case "bio":
      return normalizeBio(value);
    case "website":
      return normalizeWebsite(value);
    case "twitter":
      return normalizeTwitter(value);
    case "github":
      return normalizeGithub(value);
  }
}