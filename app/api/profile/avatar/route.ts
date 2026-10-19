import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isCloudinaryConfigured, uploadBufferToCloudinary } from "@/lib/cloudinary";
import { findAccountBySession } from "@/lib/db/users";
import {
  AVATAR_FOLDER,
  avatarProblem,
  avatarPublicId,
} from "@/lib/profile-avatar";

export const runtime = "nodejs";

/**
 * The owner's profile picture.
 *
 * Separate from `PATCH /api/profile` on purpose. This route owns exactly one
 * field and is the only way it can be *set* — the PATCH can only clear it —
 * so the value that ends up in `avatar` is, by construction, a URL that came
 * out of Cloudinary rather than a string somebody typed. That is what keeps a
 * `<img src>` on every cached profile page pointing at an image instead of at
 * something else.
 *
 * It also writes through immediately instead of handing back a URL for the
 * form to save. An upload already costs a round trip; making the author press
 * Save afterwards to keep a picture they have already chosen is a second
 * chance to lose it.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  /**
   * Checked before the form data is even read, so a deployment with no bucket
   * gets a 503 the form can explain ("uploads are not configured here") rather
   * than a 500 from deep inside the SDK. The form still saves the bio and the
   * two links — this endpoint is allowed to be unavailable, the settings page
   * is not.
   */
  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      {
        error: "Image uploads are not configured on this deployment.",
        degraded: true,
      },
      { status: 503 },
    );
  }

  const { users, account } = await findAccountBySession(
    session.user.id,
    session.user.email,
  );
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // The browser already ran this, in `lib/profile-avatar`. Run again: a check
    // the client can skip is not a check.
    const problem = avatarProblem(file);
    if (problem) {
      return NextResponse.json(
        { error: problem === "too-large" ? "That image is too large." : "Unsupported image type." },
        { status: problem === "too-large" ? 413 : 400 },
      );
    }

    /**
     * Per-account public id, not `Date.now()`. `uploadBufferToCloudinary`
     * passes `overwrite: true`, so this id is the *identity* of the asset:
     * a shared one means the next account to set a picture silently replaces
     * this one — both uploads succeed, so nothing looks broken, and the
     * profile is simply wrong. Stable per account also means a re-upload
     * replaces the old file instead of leaving one orphan per attempt.
     */
    const url = await uploadBufferToCloudinary(
      await file.arrayBuffer(),
      file.name,
      avatarPublicId(account._id!.toString()),
      { folder: AVATAR_FOLDER },
    );

    await users.updateOne(
      { _id: account._id },
      { $set: { avatar: url, updatedAt: new Date() } },
    );

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Avatar upload failed:", error);
    return NextResponse.json({ error: "Avatar upload failed" }, { status: 500 });
  }
}