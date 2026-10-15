import type { Session } from "next-auth";

/**
 * The username a component or bundle is attributed to.
 *
 * `ComponentAuthor.username` is what `listComponents({ author })` and
 * `listBundles({ author })` filter on, so every writer must derive it the same
 * way or an author's own pages will not find their work.
 */
export function sessionUsername(session: Session | null): string {
  if (!session?.user) return "anonymous";

  const explicit = (session.user as { username?: string }).username;
  if (explicit) return explicit;

  const email = session.user.email;
  if (email?.includes("@")) return email.split("@")[0];

  return session.user.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "anonymous";
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
