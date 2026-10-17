import { NextResponse } from "next/server";
import { getComponentBySlug, getComponentsCollection } from "@/lib/db/components";
import { buildComponentBundle } from "@/lib/preview/build";
import { PREVIEW_BUILD_VERSION } from "@/lib/preview/version";
import { componentPreviewFiles } from "@/lib/preview/server-files";
import { DEFAULT_DEMO_PATH } from "@/lib/studio/starter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  // The frame is user content that changes on every publish, so the browser
  // always asks. The stored build carries the hash it was made from, and that
  // hash is the ETag: an unchanged frame costs a 304, a republished one is
  // picked up on the very next view.
  "Cache-Control": "public, max-age=0, must-revalidate",
};

function htmlResponse(
  html: string,
  previewHash: string | undefined,
  request: Request
) {
  const etag = previewHash ? `"${previewHash}"` : null;

  if (etag && request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ...CACHE_HEADERS, ETag: etag },
    });
  }

  return new NextResponse(html, {
    headers: etag ? { ...CACHE_HEADERS, ETag: etag } : CACHE_HEADERS,
  });
}

async function bundleForComponent(slug: string) {
  const component = await getComponentBySlug(slug);
  if (!component) return null;

  const bundle = await buildComponentBundle(
    componentPreviewFiles({
      code: component.code,
      componentPath: component.componentPath,
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

    // A stored build is only served while it is the current build. Anything
    // from an older one is rebuilt here, so a deploy that fixes the build
    // repairs the catalogue on the next view rather than never.
    if (
      component.previewHtml &&
      component.previewVersion === PREVIEW_BUILD_VERSION
    ) {
      return htmlResponse(component.previewHtml, component.previewHash, request);
    }

    // Backfill for components published before bundling existed, or by an
    // older build.
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
          previewVersion: PREVIEW_BUILD_VERSION,
          updatedAt: new Date(),
        },
      }
    );

    return htmlResponse(result.bundle.html, result.bundle.hash, request);
  } catch (error) {
    console.error("Preview bundle error:", error);
    return NextResponse.json({ error: "Failed to build preview" }, { status: 500 });
  }
}