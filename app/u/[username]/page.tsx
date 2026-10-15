import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionUsername } from "@/lib/session";
import { resolveProfile } from "@/lib/db/users";
import { listComponents } from "@/lib/db/components";
import { listBundles } from "@/lib/db/bundles";
import { ComponentCard } from "@/components/marketplace/component-card";
import { AppShell } from "@/components/marketplace/app-shell";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import {
  ProfileBody,
  ProfileBundles,
  ProfileEmpty,
} from "@/components/profile/profile-body";

export const dynamic = "force-dynamic";

type ComponentListItem = Awaited<ReturnType<typeof listComponents>>[number];

function toCardItem(item: ComponentListItem) {
  return {
    ...item,
    createdAt: item.createdAt ? item.createdAt.toISOString() : undefined,
  };
}

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
      `Components and bundles published by ${profile.name} on Shadway.`,
  };
}

/**
 * The public profile.
 *
 * Resolution goes through `resolveProfile`, so an account found by its handle
 * wins, and the seeded content — whose authors live only inside the published
 * items — still renders. A handle with neither an account nor any work is a
 * genuine 404.
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

  const [components, bundles] = await Promise.all([
    listComponents({ author: handle, limit: 60 }).catch(() => []),
    listBundles({ author: handle, limit: 60 }).catch(() => []),
  ]);

  const viewer = session ? sessionUsername(session) : null;
  const isOwner = Boolean(viewer && viewer.toLowerCase() === handle);

  const stats = {
    components: components.length,
    views: components.reduce((sum, item) => sum + (item.views || 0), 0),
    likes: components.reduce((sum, item) => sum + (item.likes || 0), 0),
    installs: components.reduce((sum, item) => sum + (item.installs || 0), 0),
  };

  const activeTab = tabParam === "bundles" ? "bundles" : "components";
  const basePath = `/u/${handle}`;

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
        tabs={[
          { id: "components", label: "Components", count: components.length },
          { id: "bundles", label: "Bundles", count: bundles.length },
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
              title={
                isOwner ? "You haven't published anything yet" : "Nothing published yet"
              }
              body={
                isOwner
                  ? "Components you publish show up here, on your public profile."
                  : `When @${handle} publishes a component, it will show up here.`
              }
              action={
                isOwner ? (
                  <Button size="sm" asChild>
                    <Link href="/studio">Open studio</Link>
                  </Button>
                ) : undefined
              }
            />
          )
        ) : bundles.length ? (
          <ProfileBundles bundles={bundles} />
        ) : (
          <ProfileEmpty
            icon="bundles"
            title="No bundles yet"
            body={
              isOwner
                ? "Packs of components you publish will be listed here."
                : `When @${handle} publishes a bundle, it will show up here.`
            }
          />
        )}
      </ProfileBody>
    </AppShell>
  );
}
