import { NextResponse } from "next/server";
import { getComponentBySlug, getComponentsCollection } from "@/lib/db/components";
import { buildComponentBundle } from "@/lib/preview/build";
import { componentPreviewFiles } from "@/lib/preview/server-files";
import { DEFAULT_DEMO_PATH } from "@/lib/studio/starter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
};

async function bundleForComponent(slug: string) {
  const component = await getComponentBySlug(slug);
  if (!component) return null;

  const bundle = await buildComponentBundle(
    componentPreviewFiles({
      code: component.code,
      demoCode: component.demoCode,
      styleCode: component.styleCode,
      files: component.files,
    }),
    { entry: DEFAULT_DEMO_PATH, title: component.title }
  );

  return { component, bundle };
}

/**
 * Serves the prebuilt preview bundle. The bundle is created once at publish time
 * and only rebuilt when the source changes.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  try {
    const component = await getComponentBySlug(slug);
    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

    if (component.previewHtml) {
      return new NextResponse(component.previewHtml, {
        headers: CACHE_HEADERS,
      });
    }

    // Backfill for components published before bundling existed.
    const result = await bundleForComponent(slug);
    if (!result) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

    const collection = await getComponentsCollection();
    await collection.updateOne(
      { slug },
      {
        $set: {
          previewHtml: result.bundle.html,
          previewHash: result.bundle.hash,
          updatedAt: new Date(),
        },
      }
    );

    return new NextResponse(result.bundle.html, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("Preview bundle error:", error);
    return NextResponse.json({ error: "Failed to build preview" }, { status: 500 });
  }
}