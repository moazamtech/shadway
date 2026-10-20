import { NextResponse } from "next/server";
import { listVibecode } from "@/lib/db/content";
import { VibecodeComponent } from "@/lib/types";

/**
 * The moment a drop was last touched, as a number.
 *
 * A drop with no date is older than every drop that has one, which is what a
 * missing date has always meant: it belongs at the end of a list, not at the
 * front of it.
 */
function touchedAt(value?: Date): number {
  return value ? new Date(value).getTime() : 0;
}

/**
 * The published drops, the ones that were published last first.
 *
 * The accessor lists every drop, and a sitemap only ever names the ones the
 * gallery shows, so the rest are dropped here rather than being fetched and
 * then thrown away. A drop without a publication date belongs at the end of
 * the list, which is where the sort puts it.
 */
function publishedDrops(drops: VibecodeComponent[]): VibecodeComponent[] {
  return drops
    .filter((drop) => drop.status === "published")
    .sort((a, b) => {
      const published = touchedAt(b.publishedAt) - touchedAt(a.publishedAt);
      if (published !== 0) return published;
      return touchedAt(b.updatedAt) - touchedAt(a.updatedAt);
    });
}

export async function GET() {
  try {
    const baseUrl = "https://shadway.online";

    const vibecodeItems = publishedDrops(await listVibecode());

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${vibecodeItems
  .map(
    (item) => `  <url>
    <loc>${baseUrl}/vibecode/${encodeURIComponent(item.slug)}</loc>
    <lastmod>${new Date(item.updatedAt || item.publishedAt || item.createdAt || new Date()).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

    return new NextResponse(sitemap, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Error generating vibecode sitemap:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
