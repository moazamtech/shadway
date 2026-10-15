import { NextResponse } from "next/server";
import { getComponentsCollection } from "@/lib/db/components";

// Helper function to escape XML entities
function escapeXml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  try {
    if (!process.env.MONGODB_URI) {
      return new NextResponse("<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>", {
        headers: { "Content-Type": "application/xml" },
      });
    }

    const baseUrl = "https://shadway.online";
    const collection = await getComponentsCollection();

    const [items, authors] = await Promise.all([
      collection
        .find({ status: "published", visibility: "public" })
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(5000)
        .toArray(),
      collection
        .aggregate<{ _id: string; count: number }>([
          { $match: { status: "published", visibility: "public" } },
          { $group: { _id: "$author.username", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 500 },
        ])
        .toArray(),
    ]);

    const staticUrls = [
      {
        loc: `${baseUrl}/`,
        lastmod: new Date().toISOString(),
        changefreq: "daily",
        priority: "1.0",
      },
      {
        loc: `${baseUrl}/collections`,
        lastmod: new Date().toISOString(),
        changefreq: "daily",
        priority: "0.8",
      },
      ...authors.map((author) => ({
        loc: `${baseUrl}/u/${encodeURIComponent(author._id)}`,
        lastmod: new Date().toISOString(),
        changefreq: "weekly",
        priority: "0.6",
      })),
    ];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[
      ...staticUrls.map(
        (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
      ),
      ...items.map(
        (item) => `  <url>
    <loc>${escapeXml(`${baseUrl}/c/${encodeURIComponent(item.slug)}`)}</loc>
    <lastmod>${new Date(item.updatedAt || item.createdAt || new Date()).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`,
      ),
    ].join("\n")}
</urlset>`;

    return new NextResponse(sitemap, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Error generating components sitemap:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}