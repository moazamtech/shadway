import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionUsername } from "@/lib/session";
import { ensureUsername } from "@/lib/db/users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your bookmarks — Shadway",
  robots: { index: false, follow: false },
};

/**
 * Bookmarks are a tab on the profile.
 *
 * The saved list belongs to the person who saved it, and the profile is where
 * the things about that person live: the work they published, and the work
 * they kept. Two pages for one list meant two layouts for the same cards, two
 * ways for the sidebar to point at it, and a "bookmarks" page that a visitor
 * could not tell apart from a profile.
 *
 * So this address is kept — it is in saved links, in old screenshots, in other
 * people's bookmarks — and it redirects to the tab that holds the list. The
 * handle comes from the session, so the redirect lands on the reader's own
 * profile and never on anybody else's.
 */
export default async function BookmarksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/bookmarks");
  }

  const handle =
    (session.user.email
      ? await ensureUsername(session.user.email).catch(() => null)
      : null) ?? sessionUsername(session);
  redirect(`/u/${encodeURIComponent(handle)}?tab=saved`);
}
