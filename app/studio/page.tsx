import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionUsername } from "@/lib/session";
import { listUserComponents } from "@/lib/db/components";
import { AppShell } from "@/components/marketplace/app-shell";
import { StudioDashboard, type StudioItem } from "@/components/studio/studio-dashboard";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Studio | Shadway",
  description: "Manage the components you publish to Shadway.",
  robots: { index: false, follow: false },
};

/**
 * The studio home: the account's own components, drafts first.
 *
 * The editor lives one level down (`/studio/[slug]`), so coming back from a
 * project always lands here — on the list of everything the account owns.
 */
export default async function StudioPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/studio");
  }

  const items = await listUserComponents(session.user.id).catch(() => []);
  const rows: StudioItem[] = items.map((item) => ({
    slug: item.slug,
    title: item.title,
    status: item.status,
    visibility: item.visibility,
    views: item.views || 0,
    likes: item.likes || 0,
    installs: item.installs || 0,
    updatedAt: (item.updatedAt ?? item.createdAt ?? new Date()).toISOString(),
    thumbnailUrl: item.thumbnailUrl,
  }));

  const handle = sessionUsername(session);

  return (
    <AppShell
      toolbar={
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Studio
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/u/${handle}`}>Public profile</Link>
          </Button>
        </div>
      }
    >
      <StudioDashboard items={rows} />
    </AppShell>
  );
}
