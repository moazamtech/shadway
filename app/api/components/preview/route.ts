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

/**
 * The headers for a build that was asked for *by name*.
 *
 * When the request names the build it wants — `?v=<hash>` — the answer is
 * that exact document or nothing, and the browser may keep it forever. The
 * name changes when the build changes, so a stale copy is impossible: there is
 * no "is it still fresh" question left to ask.
 *
 * This is the difference between a page that revalidates its preview on every
 * visit — a round trip that answers "nothing changed" every time — and one
 * that does not. The preview of a component nobody has touched is served from
 * the browser's own disk.
 */
const IMMUTABLE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=31536000, immutable",
};

function htmlResponse(
  html: string,
  previewHash: string | undefined,
  request: Request,
  immutable = false,
) {
  const etag = previewHash ? `"${previewHash}"` : null;

  if (etag && request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ...CACHE_HEADERS, ETag: etag },
    });
  }

  return new NextResponse(html, {
    headers: {
      ...(immutable ? IMMUTABLE_HEADERS : CACHE_HEADERS),
      ...(etag ? { ETag: etag } : {}),
    },
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
  const asked = searchParams.get("v");

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
      /**
       * The build was asked for by name and this is that build: the answer is
       * immutable, and the browser will not ask again.
       *
       * A name that does not match is a name for a build that no longer
       * exists — the component was republished, or the builder changed — so
       * the request falls through to the rebuild below and the answer is the
       * current build under the ordinary headers.
       */
      const named = Boolean(asked) && asked === component.previewHash;
      return htmlResponse(
        component.previewHtml,
        component.previewHash,
        request,
        named,
      );
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