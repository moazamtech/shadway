import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin, sessionAvatar, sessionDisplayName, sessionUsername } from "@/lib/session";
import { ensureUsername, resolveProfile } from "@/lib/db/users";
import { listComponents, listComponentsBySlugs } from "@/lib/db/components";
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

  const [profile, components, savedSlugs] = await Promise.all([
    resolveProfile(handle).catch(() => null),
    listComponents({ author: handle, limit: 60 }).catch(() => []),
    getUserBookmarks(session.user.id).catch(() => [] as string[]),
  ]);
  const saved = await listComponentsBySlugs(savedSlugs).catch(() => []);

  const stats = {
    components: components.length,
    views: components.reduce((sum, item) => sum + (item.views || 0), 0),
    likes: components.reduce((sum, item) => sum + (item.likes || 0), 0),
    installs: components.reduce((sum, item) => sum + (item.installs || 0), 0),
  };

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
          { id: "components", label: "Components", count: components.length },
          { id: "saved", label: "Saved", count: saved.length },
        ]}
        stats={stats}
      >
        {activeTab === "components" ? (
          components.length ? (
            <div className="grid grid-cols-1 gap-5 min-[520px]:grid-cols-2 min-[1200px]:grid-cols-3">
              {components.map((item) => (
                <ComponentCard key={item.slug} item={toCardItem(item)} />
              ))}
            </div>
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
