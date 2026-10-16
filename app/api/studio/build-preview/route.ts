import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { BuildError, buildComponentBundle } from "@/lib/preview/build";
import { componentPreviewFiles } from "@/lib/preview/server-files";
import { capturePreview } from "@/lib/preview/capture";
import { uploadBufferToCloudinary } from "@/lib/cloudinary";
import { DEFAULT_DEMO_PATH } from "@/lib/studio/starter";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The verification step of submitting for review.
 *
 * Publishing is not a form submission: before a component enters the queue it
 * is actually built here — the same esbuild + Tailwind build the marketplace
 * serves — and the result is rendered once in headless Chrome, so the cover on
 * the feed is a real screenshot of the component, not a promise.
 *
 *   compile error            -> 422 with the real bundler message
 *   import that cannot land  -> 422 naming the file and line
 *   blank render             -> 200 with a warning (the author attaches a cover)
 *   everything renders       -> 200 with the Cloudinary cover URL
 */

type BuildInput = {
  title?: string;
  code?: string;
  demoCode?: string;
  styleCode?: string;
  files?: { path: string; content: string; type?: string }[];
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let input: BuildInput;
  try {
    input = (await request.json()) as BuildInput;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!input.code?.trim() && !input.files?.length) {
    return NextResponse.json(
      { error: "There is nothing to build yet.", step: "build" },
      { status: 422 }
    );
  }

  try {
    // Same assembly the marketplace previews use, so what the admin approves
    // is exactly what customers will see.
    const bundle = await buildComponentBundle(
      componentPreviewFiles({
        code: input.code ?? "",
        demoCode: input.demoCode ?? "",
        styleCode: input.styleCode ?? "",
        files: input.files,
      }),
      { entry: DEFAULT_DEMO_PATH, title: input.title ?? "component" }
    );

    const capture = await capturePreview(bundle.html, { width: 1200, height: 900 });

    // A blank frame is not a build failure: runtime-animated or heavily
    // client-side components can render too late (or not at all) in a single
    // headless pass. Those go to review without an auto-captured cover — the
    // author can attach one, and the admin decides with the real page open.
    const warning =
      !capture || !capture.buffer?.length
        ? "The automated cover capture came back blank. You can still submit — attach a cover image below, or add one later in the review."
        : null;

    let thumbnailUrl: string | null = null;
    if (capture?.buffer?.length) {
      try {
        thumbnailUrl = await uploadBufferToCloudinary(
          capture.buffer.buffer.slice(
            capture.buffer.byteOffset,
            capture.buffer.byteOffset + capture.buffer.byteLength
          ) as ArrayBuffer,
          `cover-${Date.now()}.png`,
          `shadway-covers/submit`
        );
      } catch (error) {
        console.error("Cover capture upload failed:", error);
      }
    }

    // The build is real; only the cover is best-effort.
    return NextResponse.json({ ok: true, thumbnailUrl, warning });
  } catch (error) {
    if (error instanceof BuildError) {
      const where = error.file
        ? ` (${error.file}${error.line ? `:${error.line}` : ""})`
        : "";
      return NextResponse.json(
        { error: `${error.message}${where}`, step: "build" },
        { status: 422 }
      );
    }

    const message = error instanceof Error ? error.message : "Build failed.";
    return NextResponse.json({ error: message, step: "build" }, { status: 422 });
  }
}
