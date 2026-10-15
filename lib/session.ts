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

  const explicit = (session.user as { username?: string }).username;
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

export function isAdmin(session: Session | null): boolean {
  return session?.user?.role === "admin";
}

export function sessionAvatar(session: Session | null): string | undefined {
  return (session?.user as { image?: string } | undefined)?.image || undefined;
}
