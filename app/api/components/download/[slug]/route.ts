import { NextResponse } from "next/server";
import { getComponentBySlug } from "@/lib/db/components";
import { incrementComponentMetric } from "@/lib/db/components";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Direct source download. Lets a user grab the raw component without the
 * shadcn CLI (useful for quick inspection or manual copy).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  try {
    const component = await getComponentBySlug(decodeURIComponent(slug));
    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

    void incrementComponentMetric(component.slug, "installs").catch(() => {});

    const extension = component.code.includes("interface ") || component.code.includes(": ") ? "tsx" : "tsx";

    return new NextResponse(component.code, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${component.slug}.${extension}"`,
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch (error) {
    console.error("Download failed:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}