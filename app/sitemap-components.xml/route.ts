import { NextResponse } from "next/server";
import { getComponentsCollection } from "@/lib/db/components";

export async function GET() {
  try {
    if (!process.env.MONGODB_URI) {
      return new NextResponse("Internal Server Error", { status: 500 });
    }

    const baseUrl = "https://shadway.online";
    const collection = await getComponentsCollection();

    const items = await collection
      .find({ status: "published", visibility: "public" })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(5000)
      .toArray();

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items
  .map(
    (item) => `  <url>
    <loc>${baseUrl}/c/${encodeURIComponent(item.slug)}</loc>
    <lastmod>${new Date(item.updatedAt || item.createdAt || new Date()).toISOString()}</lastmod>
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
    console.error("Error generating components sitemap:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}