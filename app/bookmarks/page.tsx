import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Bookmark, Search } from "lucide-react";
import Image from "next/image";
import { authOptions } from "@/lib/auth";
import { sessionUsername } from "@/lib/session";
import { getUserBookmarks } from "@/lib/db/marketplace";
import { getComponentsCollection } from "@/lib/db/components";
import { Button } from "@/components/ui/button";
import { ComponentCard } from "@/components/marketplace/component-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your bookmarks — Shadway",
  robots: { index: false, follow: false },
};

export default async function BookmarksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/bookmarks");
  }

  // Saved newest-first, then resolved in one query and re-ordered to match.
  const slugs = await getUserBookmarks(session.user.id).catch(() => []);

  let items: Awaited<ReturnType<typeof loadItems>> = [];
  if (slugs.length) {
    items = await loadItems(slugs);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 lg:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              width={20}
              height={20}
              alt="Shadway"
              className="h-5 w-5 object-contain"
            />
            <span className="text-sm font-semibold tracking-tight">Shadway</span>
          </Link>
          <Link
            href={`/u/${sessionUsername(session)}`}
            className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:block"
          >
            Profile
          </Link>
          <Button asChild variant="outline" size="sm" className="ml-auto">
            <Link href="/">
              <Search className="h-4 w-4" />
              Browse components
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-8 lg:px-6">
        <div className="mb-8 flex items-center gap-2">
          <Bookmark className="h-5 w-5" />
          <h1 className="text-2xl font-semibold tracking-tight">Bookmarks</h1>
          <span className="text-sm text-muted-foreground">({items.length})</span>
        </div>

        {items.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <ComponentCard key={item.slug} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-16 text-center">
            <Bookmark className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No saved components yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Hover any component and hit the bookmark icon to keep it here.
            </p>
            <Button className="mt-4" asChild>
              <Link href="/">Browse components</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

/** Resolves saved slugs to published components, preserving save order. */
async function loadItems(slugs: string[]) {
  const collection = await getComponentsCollection();
  const docs = await collection
    .find({ slug: { $in: slugs }, status: "published", visibility: "public" })
    .toArray();

  const bySlug = new Map(docs.map((doc) => [doc.slug, doc]));
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
    .map((doc) => ({
      slug: doc.slug,
      title: doc.title,
      description: doc.description,
      thumbnailUrl: doc.thumbnailUrl,
      videoUrl: doc.videoUrl,
      author: doc.author,
      tags: doc.tags,
      installs: doc.installs,
      views: doc.views,
      likes: doc.likes,
      // The card shows a relative age; a raw `Date` cannot cross the boundary.
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    }));
}
