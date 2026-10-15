import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Bookmark, Layers, Package, Settings, Sparkles } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { isAdmin, sessionAvatar, sessionDisplayName, sessionUsername } from "@/lib/session";
import { listComponents } from "@/lib/db/components";
import { listBundles } from "@/lib/db/bundles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ComponentCard } from "@/components/marketplace/component-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your profile — Shadway",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    // Middleware normally catches this; this keeps the page safe if it is ever
    // reached directly (e.g. a stale RSC payload).
    redirect("/login?callbackUrl=/profile");
  }

  const username = sessionUsername(session);
  const [components, bundles] = await Promise.all([
    listComponents({ author: username, limit: 24 }).catch(() => []),
    listBundles({ author: username, limit: 12 }).catch(() => []),
  ]);

  const totalInstalls = components.reduce((sum, item) => sum + (item.installs || 0), 0);
  const totalLikes = components.reduce((sum, item) => sum + (item.likes || 0), 0);
  const avatar = sessionAvatar(session);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 lg:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            <span className="text-sm font-semibold tracking-tight">Shadway</span>
          </Link>
          <Link
            href="/bundles"
            className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:block"
          >
            Bundles
          </Link>
          <Button asChild size="sm" className="ml-auto">
            <Link href="/studio">Open studio</Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-8 lg:px-6">
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-lg font-semibold">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              sessionDisplayName(session).slice(0, 2).toUpperCase()
            )}
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {sessionDisplayName(session)}
              </h1>
              {isAdmin(session) && <Badge variant="secondary">Admin</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {session.user.email}
            </p>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>
                <strong className="text-foreground">{components.length}</strong> components
              </span>
              <span>
                <strong className="text-foreground">{bundles.length}</strong> bundles
              </span>
              <span>
                <strong className="text-foreground">{totalLikes}</strong> likes
              </span>
              <span>
                <strong className="text-foreground">{totalInstalls}</strong> installs
              </span>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/bookmarks">
                <Bookmark className="h-4 w-4" />
                Bookmarks
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/u/${username}`}>
                <Sparkles className="h-4 w-4" />
                Public profile
              </Link>
            </Button>
            {isAdmin(session) && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/dashboard">
                  <Settings className="h-4 w-4" />
                  Admin panel
                </Link>
              </Button>
            )}
          </div>
        </div>

        {bundles.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Package className="h-4 w-4" />
              Your bundles
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bundles.map((bundle) => (
                <Link
                  key={bundle.slug}
                  href={`/bundles/${bundle.slug}`}
                  className="flex items-center justify-between gap-3 rounded-xl border p-4 transition hover:border-foreground/20"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{bundle.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {bundle.componentSlugs.length}{" "}
                      {bundle.componentSlugs.length === 1 ? "component" : "components"}
                    </p>
                  </div>
                  <Badge variant={bundle.isPublic ? "secondary" : "outline"}>
                    {bundle.isPublic ? "Published" : "Draft"}
                  </Badge>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12">
          <h2 className="mb-4 text-sm font-semibold tracking-tight">Your components</h2>
          {components.length ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {components.map((item) => (
                <ComponentCard key={item.slug} item={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-12 text-center">
              <p className="text-sm font-medium">Nothing published yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Write your first component in the studio and publish it.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/studio">Open studio</Link>
              </Button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
