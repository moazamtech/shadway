import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { VibecodeComponent } from "@/lib/types";

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const baseUrl = "https://shadway.online";

    const vibecodeItems = await db
      .collection<VibecodeComponent>("vibecode")
      .find({ status: "published" })
      .sort({ publishedAt: -1, updatedAt: -1 })
      .toArray();

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
