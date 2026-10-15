/**
 * Public handles.
 *
 * A handle is an account's public identity and the key `/u/[handle]` resolves
 * on. It is stored on the `users` document, but it is *derived* the first time
 * it is needed — from the account's email — which means the publish path
 * (`sessionUsername`) and the profile lookup must derive it through these same
 * functions. If they ever disagree, an author's work stops appearing on their
 * own profile page.
 *
 * Deliberately dependency-free: the session helper imports this module, and it
 * must stay usable from anywhere, DB or not.
 */

/**
 * Handles are lowercase, hyphenated, 3–30 chars, and never start or end on a
 * hyphen. Same rules the register form shows.
 */
const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;

/** Handles that would shadow routes or read as system accounts. */
const RESERVED_HANDLES = new Set([
  "admin",
  "administrator",
  "anonymous",
  "api",
  "bookmarks",
  "bundles",
  "c",
  "collections",
  "dashboard",
  "help",
  "login",
  "logout",
  "me",
  "new",
  "null",
  "profile",
  "r",
  "register",
  "root",
  "settings",
  "shadway",
  "studio",
  "support",
  "system",
  "u",
  "undefined",
  "user",
  "www",
]);

/** Lowercases and collapses anything that is not a letter or digit into `-`. */
export function normalizeHandle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}

const HANDLE_FALLBACK = "creator";

/**
 * The handle an account is born with: its email's local part, normalized.
 *
 * The name is only consulted when the email yields nothing usable — the email
 * is unique by definition, the display name is not.
 */
export function deriveHandleFromEmail(email: string, name?: string): string {
  const local = email.includes("@") ? email.split("@")[0] : email;
  const handle = normalizeHandle(local);
  if (handle.length >= 3 && HANDLE_RE.test(handle)) return handle;

  const fromName = normalizeHandle(name ?? "");
  if (fromName.length >= 3 && HANDLE_RE.test(fromName)) return fromName;

  return handle || fromName || HANDLE_FALLBACK;
}

export function isValidHandle(value: string): boolean {
  return HANDLE_RE.test(value) && !RESERVED_HANDLES.has(value);
}

export function isReservedHandle(value: string): boolean {
  return RESERVED_HANDLES.has(value);
}
