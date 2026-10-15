import { NextResponse } from "next/server";
import { buildRegistryItem } from "@/lib/registry";

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
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  try {
    // Next decodes dynamic params already; decoding again would break any slug
    // containing a literal `%`.
    const segments = (await params).slug ?? [];

    const item =
      segments.length === 1
        ? await buildRegistryItem({ slug: segments[0] })
        : segments.length === 2
          ? await buildRegistryItem({
              author: segments[0],
              slug: segments[1],
            })
          : null;

    if (!item) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

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
