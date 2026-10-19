import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionUsername } from "@/lib/session";
import { resolveProfile } from "@/lib/db/users";
import {
  EMPTY_AUTHOR_STATS,
  getAuthorStats,
  listComponents,
  listComponentsBySlugs,
  MAX_PAGE_SIZE,
} from "@/lib/db/components";
import { getUserBookmarks } from "@/lib/db/marketplace";
import { normalizeGroup } from "@/lib/categories";
import { serializeCard } from "@/lib/serialize";
import { ComponentGrid } from "@/components/marketplace/component-grid";
import { AppShell } from "@/components/marketplace/app-shell";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import {
  ProfileBody,
  ProfileEmpty,
  type ProfileTab,
} from "@/components/profile/profile-body";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await resolveProfile(decodeURIComponent(username)).catch(
    () => null,
  );
  if (!profile) return { title: "Profile not found · Shadway" };

  return {
    title: `${profile.name} (@${profile.handle}) · Shadway`,
    description:
      profile.bio ||
      `Components published by ${profile.name} on Shadway.`,
  };
}

/**
 * The public profile.
 *
 * Resolution goes through `resolveProfile`, so an account found by its handle
 * wins, and the seeded content — whose authors live only inside the published
 * items — still renders. A handle with neither an account nor any work is a
 * genuine 404.
 *
 * The work is the feed's grid, so a visitor can search it, sort it and cut it
 * down by category instead of scrolling whatever page of it fitted under the
 * ceiling. The owner's Saved tab is here too, and only here: a link to
 * `/profile` that says the same thing would be one more click for the one
 * person who cannot use a public page to see anything private.
 */
export default async function AuthorPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ username }, { tab: tabParam }, session] = await Promise.all([
    params,
    searchParams,
    getServerSession(authOptions),
  ]);

  const profile = await resolveProfile(decodeURIComponent(username));
  if (!profile) notFound();
  const handle = profile.handle;

  const viewer = session ? sessionUsername(session) : null;
  const isOwner = Boolean(viewer && viewer.toLowerCase() === handle);

  const [stats, published, savedSlugs] = await Promise.all([
    getAuthorStats(handle).catch(() => EMPTY_AUTHOR_STATS),
    listComponents({ author: handle, limit: MAX_PAGE_SIZE }).catch(() => []),
    // Bookmarks are read for the owner only. Every other visitor pays for this
    // page but none of them may see a list saved by somebody else's account.
    isOwner && session?.user?.id
      ? getUserBookmarks(session.user.id).catch(() => [] as string[])
      : Promise.resolve([] as string[]),
  ]);

  const items = published.map(serializeCard);
  const saved = (isOwner
    ? await listComponentsBySlugs(savedSlugs)
    : []
  ).map(serializeCard);

  // The taxonomy's two groups are the two tabs, and `normalizeGroup` is the
  // fold that decides them: a component stored as `hero`, `block` or `pricing`
  // is a block even though its stored string is none of those. Reading the raw
  // field is what gave the rail three sections over one category, and it would
  // do the same here — a Blocks tab that counts four and shows none.
  const tabs: ProfileTab[] = [
    {
      id: "components",
      label: "Components",
      count: items.filter((item) => normalizeGroup(item.category) === "ui")
        .length,
    },
    {
      id: "blocks",
      label: "Blocks",
      count: items.filter(
        (item) => normalizeGroup(item.category) === "marketing"
      ).length,
    },
  ];
  if (isOwner) {
    tabs.push({ id: "saved", label: "Saved", count: saved.length });
  }

  // A tab the page does not have falls back to the first one, so
  // `?tab=saved` from a shared link is a stranger's profile rather than an
  // empty pane. The counts of the two work tabs add up to the Components stat,
  // because they are a partition of the same published set.
  const requested = tabParam ?? tabs[0].id;
  const activeTab = tabs.some((tab) => tab.id === requested)
    ? requested
    : tabs[0].id;

  const basePath = `/u/${handle}`;

  const studioAction = isOwner ? (
    <Button size="sm" asChild>
      <Link href="/studio">Open studio</Link>
    </Button>
  ) : undefined;

  /**
   * "Nothing here" means something different per tab: an author who has
   * shipped no landing page sections has not shipped nothing, and telling them
   * otherwise is how a profile ends up contradicting its own tab badge.
   */
  function emptyState() {
    if (activeTab === "saved") {
      return (
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
      );
    }

    if (activeTab === "blocks") {
      return (
        <ProfileEmpty
          title={
            isOwner
              ? "You haven't published any blocks yet"
              : "No blocks yet"
          }
          body={
            isOwner
              ? "Landing page sections you publish show up here, on your public profile."
              : `When @${handle} publishes a landing page section, it will show up here.`
          }
          action={studioAction}
        />
      );
    }

    return (
      <ProfileEmpty
        title={
          isOwner ? "You haven't published anything yet" : "Nothing published yet"
        }
        body={
          isOwner
            ? "Components you publish show up here, on your public profile."
            : `When @${handle} publishes a component, it will show up here.`
        }
        action={studioAction}
      />
    );
  }

  return (
    <AppShell
      toolbar={
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Browse components</Link>
          </Button>
          <UserMenu />
        </div>
      }
    >
      <ProfileBody
        handle={handle}
        name={profile.name}
        avatar={profile.avatar}
        bio={profile.bio}
        website={profile.website}
        twitter={profile.twitter}
        github={profile.github}
        joinedAt={profile.joinedAt}
        isOwner={isOwner}
        basePath={basePath}
        activeTab={activeTab}
        tabs={tabs}
        stats={stats}
      >
        {/* A grid is one page of a library, while the stat tiles above count
            the whole registry — the count used to be made from this very
            page, so a prolific author was reported as owning exactly as many
            components as fit under the ceiling. Say which is which instead of
            letting the two numbers read as a disagreement. */}
        {activeTab !== "saved" && items.length < stats.components ? (
          <p className="mb-4 text-xs text-muted-foreground">
            Showing the {items.length} most recent of {stats.components}{" "}
            published.
          </p>
        ) : null}

        <ComponentGrid
          items={activeTab === "saved" ? saved : items}
          group={
            activeTab === "components"
              ? "ui"
              : activeTab === "blocks"
                ? "marketing"
                : undefined
          }
          // The owner is looking at their own name in the heading above every
          // card; the Saved tab holds other people's work and keeps its bylines.
          hideAuthor={activeTab !== "saved"}
          empty={emptyState()}
        />
      </ProfileBody>
    </AppShell>
  );
}
