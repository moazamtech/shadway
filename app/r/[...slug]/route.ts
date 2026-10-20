import { NextResponse } from "next/server";
import { buildRegistryItem } from "@/lib/registry";
import { incrementComponentMetric } from "@/lib/db/components";
import { isDatabaseConfigured } from "@/lib/db/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The registry endpoint the shadcn CLI consumes.
 *
 * One catch-all rather than sibling `[name]` / `[author]/[slug]` routes:
 * Next.js refuses to compile two different dynamic segment names at the same
 * path level, so a single handler that dispatches on segment count sidesteps
 * the conflict and keeps the addressing rules in one readable place.
 *
 *   /r/<slug>              a component
 *   /r/<author>/<slug>     the same component, addressed per-author
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  try {
    // Next decodes dynamic params already; decoding again would break any slug
    // containing a literal `%`.
    const segments = (await params).slug ?? [];

    /**
     * Where this request came from, which is the only place the host the CLI
     * is talking to can come from.
     *
     * A component's own `registryDependencies` have to be rewritten into
     * absolute URLs before they leave here. `buildRegistryItem` used to be
     * called without an origin, so every one of them shipped as `/r/<slug>` —
     * and the CLI's test for "is this a URL" is `new URL()`, which a relative
     * path fails. It therefore resolved them as component *names* in the
     * default shadcn/ui registry, which is not where shadway lives, so every
     * install that pulled in a dependency died naming something the author
     * never wrote.
     */
    const origin = new URL(request.url).origin;

    const item =
      segments.length === 1
        ? await buildRegistryItem({ slug: segments[0] }, { origin })
        : segments.length === 2
          ? await buildRegistryItem(
              {
                author: segments[0],
                slug: segments[1],
              },
              { origin }
            )
          : null;

    if (!item) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

    /**
     * An install is the CLI asking for the item.
     *
     * The registry is the only place a component can be installed from, so a
     * request for it is the closest thing this product has to a download. The
     * count is written in the background: the CLI is waiting on the answer,
     * and a counter must never be the reason an install is slow.
     *
     * Only the item that was asked for counts. A component that pulls in a
     * dependency is installed as part of that install, not instead of it.
     */
    void incrementComponentMetric(segments[segments.length - 1], "installs").catch(
      () => {},
    );

    return NextResponse.json(item, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Registry error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
