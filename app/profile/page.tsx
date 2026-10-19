import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin, sessionAvatar, sessionDisplayName, sessionUsername } from "@/lib/session";
import { ensureUsername, resolveProfile } from "@/lib/db/users";
import {
  EMPTY_AUTHOR_STATS,
  getAuthorStats,
  listComponents,
  listComponentsBySlugs,
  MAX_PAGE_SIZE,
} from "@/lib/db/components";
import { serializeCard } from "@/lib/serialize";
import { getUserBookmarks } from "@/lib/db/marketplace";
import { Button } from "@/components/ui/button";
import { ComponentCard } from "@/components/marketplace/component-card";
import { AppShell } from "@/components/marketplace/app-shell";
import { ProfileBody, ProfileEmpty } from "@/components/profile/profile-body";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your profile · Shadway",
  robots: { index: false, follow: false },
};

type ComponentListItem = Awaited<ReturnType<typeof listComponents>>[number];

/**
 * `listComponents` returns projected Mongo documents. The card is a client
 * component and takes a serialized `createdAt`; a `Date` (and the `_id`
 * ObjectId) cannot cross the server/client boundary, so normalize here rather
 * than loosening the card's type.
 */
function toCardItem(item: ComponentListItem) {
  return serializeCard(item);
}

/**
 * The signed-in owner's own profile — the page behind the rail's avatar.
 *
 * It is the same body the public page renders (so what you check here is what
 * visitors see), plus a Saved tab and the owner's shortcuts. Work is filtered
 * by this account's handle, the handle `resolveAuthor` stamps on every publish
 * — the one identity rule the whole app shares.
 *
 * The public page splits the work into the taxonomy's two groups, because a
 * visitor arriving at a stranger's profile needs to tell a hero section from a
 * button. The owner knows what they wrote, so this one keeps the flat list and
 * spends the saved round trip on the counts instead.
 */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [session, { tab: tabParam }] = await Promise.all([
    getServerSession(authOptions),
    searchParams,
  ]);
  if (!session?.user) {
    // Middleware normally catches this; this keeps the page safe if it is ever
    // reached directly (e.g. a stale RSC payload).
    redirect("/login?callbackUrl=/profile");
  }

  const email = session.user.email;
  const handle =
    (email ? await ensureUsername(email).catch(() => null) : null) ??
    sessionUsername(session);

  const [profile, stats, components, savedSlugs] = await Promise.all([
    resolveProfile(handle).catch(() => null),
    // Counted by the database rather than added up over the page of cards
    // below: that page stops at `MAX_PAGE_SIZE`, so an author past the ceiling
    // was reported as owning exactly as many components as the grid could
    // show — and the tab badge repeated the same wrong number beside it.
    getAuthorStats(handle).catch(() => EMPTY_AUTHOR_STATS),
    listComponents({ author: handle, limit: MAX_PAGE_SIZE }).catch(() => []),
    getUserBookmarks(session.user.id).catch(() => [] as string[]),
  ]);
  const saved = await listComponentsBySlugs(savedSlugs).catch(() => []);

  const activeTab = tabParam === "saved" ? "saved" : "components";
  const basePath = "/profile";

  return (
    <AppShell
      toolbar={
        <div className="ml-auto flex items-center gap-2">
          {isAdmin(session) ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/dashboard">Admin panel</Link>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/u/${handle}`}>View public profile</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/studio">Open studio</Link>
          </Button>
        </div>
      }
    >
      <ProfileBody
        handle={profile?.handle ?? handle}
        name={profile?.name || sessionDisplayName(session)}
        avatar={profile?.avatar || sessionAvatar(session)}
        bio={profile?.bio}
        website={profile?.website}
        twitter={profile?.twitter}
        github={profile?.github}
        joinedAt={profile?.joinedAt}
        isOwner
        basePath={basePath}
        activeTab={activeTab}
        tabs={[
          // The badge counts everything they have published, not the page the
          // grid below managed to draw — the same number the Components stat
          // reports, so the tab and the tile cannot disagree.
          { id: "components", label: "Components", count: stats.components },
          { id: "saved", label: "Saved", count: saved.length },
        ]}
        stats={stats}
      >
        {activeTab === "components" ? (
          components.length ? (
            <>
              {components.length < stats.components ? (
                <p className="mb-4 text-xs text-muted-foreground">
                  Showing the {components.length} most recent of{" "}
                  {stats.components} published.
                </p>
              ) : null}
              <div className="grid grid-cols-1 gap-5 min-[520px]:grid-cols-2 min-[1200px]:grid-cols-3">
                {components.map((item) => (
                  <ComponentCard key={item.slug} item={toCardItem(item)} />
                ))}
              </div>
            </>
          ) : (
            <ProfileEmpty
              title="Nothing published yet"
              body="Write your first component in the studio and publish it — it will land here, and on your public profile."
              action={
                <Button size="sm" asChild>
                  <Link href="/studio">Open studio</Link>
                </Button>
              }
            />
          )
        ) : saved.length ? (
          <div className="grid grid-cols-1 gap-5 min-[520px]:grid-cols-2 min-[1200px]:grid-cols-3">
            {saved.map((item) => (
              <ComponentCard key={item.slug} item={toCardItem(item)} />
            ))}
          </div>
        ) : (
          <ProfileEmpty
            icon="saved"
            title="No bookmarks yet"
            body="Components you save from the feed land here, so you can find them again when you need them."
            action={
              <Button size="sm" variant="outline" asChild>
                <Link href="/">Browse components</Link>
              </Button>
            }
          />
        )}
      </ProfileBody>
    </AppShell>
  );
}
