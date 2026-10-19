import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getComponentBySlug, getComponentsCollection } from "@/lib/db/components";
import { buildComponentBundle } from "@/lib/preview/build";
import { PREVIEW_BUILD_VERSION } from "@/lib/preview/version";
import { componentPreviewFiles } from "@/lib/preview/server-files";
import { DEFAULT_DEMO_PATH } from "@/lib/studio/starter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The published artifact, at an address of its own.
 *
 * A component is a document. Once it is published there is a built copy of it
 * — the same bytes the preview shows — and that copy deserves an address that
 * says "this is the component", not "this is an API that returns a component".
 * `/p/<slug>` is that address: open it and the component fills the page, with
 * nothing of ours around it, and `?theme=dark` asks for the dark copy of the
 * same build.
 *
 * The build is stored with the component and only rebuilt when the source
 * changes, so this is a document served, not a page rendered: the cost is one
 * database read.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const theme = request.nextUrl.searchParams.get("theme") === "dark" ? "dark" : "light";

  let html: string | null = null;
  let hash: string | undefined;

  try {
    const component = await getComponentBySlug(slug);
    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

    if (component.previewHtml && component.previewVersion === PREVIEW_BUILD_VERSION) {
      html = component.previewHtml;
      hash = component.previewHash;
    } else {
      // A stored build from an older builder is rebuilt once, in the
      // background of this request, and written back.
      const bundle = await buildComponentBundle(
        componentPreviewFiles({
          code: component.code,
          componentPath: component.componentPath,
          demoCode: component.demoCode,
          styleCode: component.styleCode,
          files: component.files,
        }),
        { entry: DEFAULT_DEMO_PATH, title: component.title },
      );
      html = bundle.html;
      hash = bundle.hash;

      const collection = await getComponentsCollection();
      await collection.updateOne(
        { slug },
        {
          $set: {
            previewHtml: bundle.html,
            previewHash: bundle.hash,
            previewVersion: PREVIEW_BUILD_VERSION,
            updatedAt: new Date(),
          },
        },
      );
    }
  } catch (error) {
    console.error("Published artifact error:", error);
    return NextResponse.json({ error: "Failed to build the component" }, { status: 500 });
  }

  if (!html) {
    return NextResponse.json({ error: "Component not found" }, { status: 404 });
  }

  /**
   * The theme is a class on the document, so the two copies are the same
   * bytes with one attribute changed. Doing it here means the stored build
   * stays the one the site made, and the address is what decides how it is
   * painted.
   */
  const themed = html.replace(
    /<html lang="en" class="[^"]*">/,
    `<html lang="en" class="${theme === "dark" ? "dark" : ""}">`,
  );

  return new NextResponse(themed, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      ...(hash ? { ETag: `"${hash}"` } : {}),
    },
  });
}
