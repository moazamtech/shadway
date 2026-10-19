import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionUsername } from "@/lib/session";
import { ensureUsername } from "@/lib/db/users";

export const dynamic = "force-dynamic";

/**
 * `/profile` is an address, not a page.
 *
 * There were two profiles: this one, and `/u/[username]`. They rendered the same
 * person from the same rows through the same `ProfileBody`, but they were two
 * separate server components, which meant every fix landed twice or — more
 * usually, and as happened here — once. This one had a flat list where the
 * public page had the taxonomy's two tabs; that one counted tabs from the page
 * of items it had already fetched while this one counted from the database, so
 * the same author's component count differed depending on which URL you were
 * standing on. Neither page was wrong on its own; there was simply no single
 * answer to "how many components has this person published".
 *
 * So the public page is the page. A profile is a public thing that its owner
 * happens to be able to see extra tabs on — the owner's view is a superset, not
 * a second document — and `/u/[username]` is the address other people can share,
 * which is the one that has to be canonical.
 *
 * This route stays because it is in the rail, in the settings page and in
 * bookmarks people already have. `redirect()` is a 307, so the browser keeps the
 * method and the tab a reader asked for survives the hop.
 */
export default async function LegacyProfileRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, params] = await Promise.all([
    getServerSession(authOptions),
    searchParams,
  ]);

  if (!session?.user) {
    // Same as the page this replaces: middleware normally catches this, and the
    // `callbackUrl` is what makes signing in land back here rather than home.
    redirect("/login?callbackUrl=/profile");
  }

  const email = session.user.email;
  const handle =
    (email ? await ensureUsername(email).catch(() => null) : null) ??
    sessionUsername(session);

  /**
   * Only `tab` is carried across.
   *
   * Forwarding the whole `searchParams` object would turn this into an open
   * redirect for any key anyone appends, and there is exactly one parameter the
   * destination page reads. `tab` is validated there — an id it does not have
   * falls back to the first tab — so nothing needs checking here.
   */
  const tab = typeof params.tab === "string" ? params.tab : undefined;
  const query = tab ? `?tab=${encodeURIComponent(tab)}` : "";

  redirect(`/u/${encodeURIComponent(handle)}${query}`);
}
