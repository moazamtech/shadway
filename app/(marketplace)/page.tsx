import { Suspense } from "react";
import { Metadata } from "next";
import { ComponentExchangeHome } from "@/components/component-exchange-home";
import { ShellToolbar } from "@/components/marketplace/shell-toolbar";
import { listComponents } from "@/lib/db/components";
import { serializeCard } from "@/lib/serialize";
import { FEED_LIMIT } from "@/lib/feed";
import { remember } from "@/lib/catalogue-cache";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata: Metadata = generateSEOMetadata({
  title: "Shadway | shadcn Component Exchange",
  description:
    "A live registry of installable shadcn-compatible React components, with real previews, dependency-aware installs, and publisher profiles.",
  keywords: [
    "shadcn registry",
    "shadcn components",
    "react component exchange",
    "installable ui components",
    "tailwind css components",
    "component sharing platform",
  ],
  url: "/",
});

// The feed is rendered per request rather than prerendered: the marketplace
// changes whenever someone publishes, and a build-time snapshot of it would be
// wrong the moment it shipped.
export const dynamic = "force-dynamic";

/**
 * The feed, read once and kept for a moment.
 *
 * The page is rendered per request rather than prerendered: the marketplace
 * changes whenever someone publishes, and a build-time snapshot of it would be
 * wrong the moment it shipped. But a request is also a *round trip* to the
 * database, and a reader who clicks "Home" waits for it — the page they were
 * on goes and the new one has not arrived, which reads as a blank screen
 * rather than as a page that is quick.
 *
 * So the feed is kept for a few seconds, and the cache is thrown away the
 * moment anything is published: what the author just published is on the
 * page before anyone goes looking for it, and going back and forth never
 * waits for the database.
 */
const readFeed = () =>
  remember("catalogue:feed", () =>
    listComponents({ sort: "latest", limit: FEED_LIMIT })
      .then((rows) => rows.map(serializeCard))
      .catch(() => [])
  );

/**
 * The marketplace home.
 *
 * The first page of the feed is read here and handed to the client component
 * as its starting state, so the grid is part of the first response instead of
 * appearing after the JavaScript bundle has loaded, hydrated, and then asked
 * for it. The client owns everything after that — sorting, filtering, liking —
 * and refetches only when the server had nothing to hand over.
 */
export default async function HomePage() {
  const items = await readFeed();

  return (
    <Suspense>
      <ComponentExchangeHome initialItems={items} />
    </Suspense>
  );
}
