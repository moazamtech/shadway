import { Suspense } from "react";
import { Metadata } from "next";
import { ComponentExchangeHome } from "@/components/component-exchange-home";
import { listComponents } from "@/lib/db/components";
import { serializeCard } from "@/lib/serialize";
import { FEED_LIMIT } from "@/lib/feed";
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
 * The marketplace home.
 *
 * The first page of the feed is read here and handed to the client component
 * as its starting state, so the grid is part of the first response instead of
 * appearing after the JavaScript bundle has loaded, hydrated, and then asked
 * for it. The client owns everything after that — sorting, filtering, liking —
 * and refetches only when the server had nothing to hand over.
 */
export default async function HomePage() {
  const items = await listComponents({ sort: "latest", limit: FEED_LIMIT })
    .then((rows) => rows.map(serializeCard))
    .catch(() => []);

  return (
    <Suspense>
      <ComponentExchangeHome initialItems={items} />
    </Suspense>
  );
}
