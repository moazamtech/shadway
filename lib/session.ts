import type { Session } from "next-auth";
import { deriveHandleFromEmail } from "@/lib/handles";

/**
 * The username a component is attributed to.
 *
 * `ComponentAuthor.username` is what `listComponents({ author })` filters on,
 * so every writer must derive it the same way or an author's own pages will
 * not find their work. The rule lives in `lib/handles.ts` next to the profile
 * lookup that has to agree with it.
 */
export function sessionUsername(session: Session | null): string {
  if (!session?.user) return "anonymous";

  // Carried on the token since sign-in, where it is read from the account
  // rather than guessed — see the comment in `lib/auth.ts` for why the guess is
  // not the same value. A token issued before that field existed falls through.
  const explicit = session.user.username;
  if (explicit) return explicit;

  const email = session.user.email;
  if (email) return deriveHandleFromEmail(email, session.user.name);

  return (
    session.user.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "anonymous"
  );
}

export function sessionDisplayName(session: Session | null): string {
  if (!session?.user) return "Guest";
  return session.user.name || session.user.email || "Anonymous";
}

/**
 * `undefined` is part of the contract, not an oversight.
 *
 * `getServerSession()` resolves to `Session | null`, but a session that has not
 * been awaited yet, or a route that passes its own optional parameter straight
 * through, is `undefined` — and the body here already handles it (`session?.`).
 * Narrowing the *type* to exclude it only pushes a `?? null` into every caller,
 * which is how one of them eventually writes `?? null` in the wrong place.
 */
export function isAdmin(session: Session | null | undefined): boolean {
  return session?.user?.role === "admin";
}

export function sessionAvatar(session: Session | null): string | undefined {
  return (session?.user as { image?: string } | undefined)?.image || undefined;
}
