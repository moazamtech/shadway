import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { isCloudinaryConfigured, uploadBufferToCloudinary } from "@/lib/cloudinary";

export const runtime = "nodejs";

/**
 * Component media: one cover, one demo loop.
 *
 * This wrote anything anyone sent, for anyone, into the deployment's own
 * Cloudinary account — and it uploaded every file as an image, which is why
 * "Upload demo video" never produced a playable video. The rules here are the
 * difference between a media endpoint and an open bucket:
 *
 * 1. A session is required. Publishing already needs one; a file whose URL is
 *    about to be stored on a component should not be able to arrive without an
 *    account behind it.
 * 2. The file is classified by its own MIME type, not by the `kind` field. A
 *    body that says `kind=image` and carries an MP4 used to be uploaded as an
 *    image; now the type decides, and a mismatch is a 415.
 * 3. Only the formats a `<img>` or `<video>` can actually paint are accepted,
 *    so this cannot be used to host an HTML page or an executable under a
 *    Cloudinary URL.
 * 4. Videos go up as `resource_type: video`, which is what makes the returned
 *    URL a `/video/upload/` URL that the card can play on hover.
 */

type MediaKind = "image" | "video";

const ALLOWED: Record<MediaKind, readonly string[]> = {
  image: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
};

const MAX_BYTES = 10_000_000;

export async function POST(request: Request) {
  const { response } = await requireSession();
  if (response) return response;

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Media uploads are not configured on this deployment." },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  const file = formData.get("file");
  const requested = formData.get("kind");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Media must be 10 MB or smaller." },
      { status: 413 },
    );
  }

  const type = (file.type || "").toLowerCase();
  const kind: MediaKind | null =
    ALLOWED.image.includes(type) ? "image" : ALLOWED.video.includes(type) ? "video" : null;

  if (!kind) {
    return NextResponse.json(
      {
        error:
          "Unsupported file type. Upload a PNG, JPEG, WebP, GIF or AVIF cover, or an MP4, WebM or MOV video.",
      },
      { status: 415 },
    );
  }
  if (requested === "image" && kind === "video") {
    return NextResponse.json(
      { error: "That is a video — upload it as the demo video, not the cover." },
      { status: 415 },
    );
  }
  if (requested === "video" && kind === "image") {
    return NextResponse.json(
      { error: "That is an image — upload it as the cover, not the demo video." },
      { status: 415 },
    );
  }

  // Keep the extension the browser told us, not the one in the filename: the
  // temp file Cloudinary reads has to be a type it can probe, and the MIME
  // allow-list above is the only thing that was validated.
  const extension = type === "video/quicktime" ? ".mov" : `.${type.split("/")[1]}`;

  try {
    const url = await uploadBufferToCloudinary(
      await file.arrayBuffer(),
      `upload${extension}`,
      `shadway-component-${kind}-${Date.now()}`,
      { folder: "shadway_components", resourceType: kind },
    );

    return NextResponse.json({ url, kind });
  } catch (error) {
    console.error("Component media upload failed:", error);
    return NextResponse.json({ error: "Media upload failed" }, { status: 500 });
  }
}
