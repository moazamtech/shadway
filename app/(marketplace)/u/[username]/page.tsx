import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
import { serializeCard } from "@/lib/serialize";
import { remember } from "@/lib/catalogue-cache";
import { ComponentGrid } from "@/components/marketplace/component-grid";
import { ShellToolbar } from "@/components/marketplace/shell-toolbar";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import {
  ProfileBody,
  ProfileEmpty,
  type ProfileTab,
} from "@/components/profile/profile-body";

export const dynamic = "force-dynamic";

/**
 * The page's public half, read once and kept for a moment.
 *
 * A profile is read on every visit and changes when its owner publishes, so
 * it cannot be a build-time snapshot. It can be a *short* one: the pages that
 * show the catalogue keep their answer for a moment and are emptied the
 * moment anything is published, so going back and forth between a profile and
 * the feed never waits for the database, and what was just published is on
 * the page before anyone goes looking for it.
 */
const readProfile = (handle: string) =>
  remember(`catalogue:profile:${handle}`, () =>
    resolveProfile(handle).catch(() => null)
  );

const readStats = (handle: string) =>
  remember(`catalogue:stats:${handle}`, () =>
    getAuthorStats(handle).catch(() => EMPTY_AUTHOR_STATS)
  );

const readPublished = (handle: string) =>
  remember(`catalogue:published:${handle}`, () =>
    listComponents({ author: handle, limit: MAX_PAGE_SIZE }).catch(() => [])
  );

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

  const profile = await readProfile(decodeURIComponent(username));

  /**
   * There is nobody here.
   *
   * The answer is sent to a page that has nothing between it and the server,
   * because the shell's boundary — the one that keeps the screen from
   * blanking during a navigation — would swallow the answer and turn a 404
   * into a 200 with a not-found page inside it. What a crawler reads and what
   * a cache stores is the status line, so the status line has to be right.
   */
  if (!profile) redirect("/404");

  const handle = profile.handle;

  const viewer = session ? sessionUsername(session) : null;
  const isOwner = Boolean(viewer && viewer.toLowerCase() === handle);

  const [stats, published, savedSlugs] = await Promise.all([
    readStats(handle),
    readPublished(handle),
    // Bookmarks are read for the owner only. Every other visitor pays for
    // this page but none of them may see a list saved by somebody else's
    // account.
    isOwner && session?.user?.id
      ? getUserBookmarks(session.user.id).catch(() => [] as string[])
      : Promise.resolve([] as string[]),
  ]);

  const items = published.map(serializeCard);
  const saved = (isOwner
    ? await listComponentsBySlugs(savedSlugs)
    : []
  ).map(serializeCard);

  /**
   * One tab for the work, one for what was saved.
   *
   * The taxonomy's two groups used to be two tabs, which split a creator's
   * library in half for a distinction the author never made: they published a
   * button and a hero section, and the page told them they had two shelves.
   * Everything published now sits on one shelf, in the order it was published;
   * the group is still a property of each item (the feed and the registry
   * filter on it), it is not a filing cabinet on someone's own page.
   */
  const tabs: ProfileTab[] = [
    {
      id: "components",
      label: "Published",
      count: items.length,
    },
  ];
  if (isOwner) {
    tabs.push({ id: "saved", label: "Saved", count: saved.length });
  }

  // A tab the page does not have falls back to the first one, so
  // `?tab=saved` from a shared link is a stranger's profile rather than an
  // empty pane, and a link to the old `?tab=blocks` still lands on the work.
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
    <>
      <ShellToolbar>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Browse components</Link>
          </Button>
          <UserMenu />
        </div>
      </ShellToolbar>

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
        savedCount={saved.length}
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
          empty={emptyState()}
        />
      </ProfileBody>
    </>
  );
}
