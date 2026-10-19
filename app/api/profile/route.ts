import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Document } from "mongodb";
import { authOptions } from "@/lib/auth";
import { findAccountBySession, type UserDocument } from "@/lib/db/users";
import {
  PROFILE_TEXT_FIELDS,
  normalizeProfileField,
  type ProfileTextField,
} from "@/lib/profile-links";

export const runtime = "nodejs";

/**
 * The public profile, written by its owner.
 *
 * `PATCH /api/me` is the sibling that changes the display name and the
 * password; this is the one that changes what a stranger sees. They are
 * separate because the trust shapes are different: the password endpoint
 * re-verifies a secret, while this one has to be paranoid about what it is
 * willing to put in a field that is rendered as an `href`.
 *
 * Two rules do the work here:
 *
 * 1. **Allow-list, never deny-list.** The body is walked against
 *    `PROFILE_TEXT_FIELDS` and nothing else is ever read off it. So a request
 *    carrying `role`, `email`, `username`, `password` or `_id` does not get
 *    those fields *filtered out* — they are never looked at, and
 *    `{"role":"admin"}` has nowhere in the update to land. The one exception
 *    is `avatar`, which is accepted only as `""` (see below).
 * 2. **One implementation of "is this a safe link".** The form already showed
 *    the author what each field would be stored as; the server runs those
 *    exact same functions, so a value cannot be made unsafe by editing the
 *    request by hand, and a form the server disagrees with is impossible.
 */
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const payload = (body ?? {}) as Record<string, unknown>;

  const { users, account } = await findAccountBySession(
    session.user.id,
    session.user.email,
  );
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const set: Partial<UserDocument> = {};
  const unset: Document = {};
  const errors: string[] = [];
  const stored: Partial<Record<ProfileTextField, string>> = {};

  for (const field of PROFILE_TEXT_FIELDS) {
    // `hasOwnProperty` rather than `field in payload`: the body is
    // attacker-controlled JSON and may carry `__proto__` or a name that
    // resolves up the prototype chain. Nothing outside this loop is read, so
    // the worst case is a rejected field — but there is no reason to make that
    // depend on how the object was built.
    if (!Object.prototype.hasOwnProperty.call(payload, field)) continue;

    const result = normalizeProfileField(field, payload[field]);
    if (!result.ok) {
      errors.push(result.message);
      continue;
    }
    stored[field] = result.value;
    // Empty is a real value and means "clear this", so it becomes an `$unset`
    // rather than an empty string. `$set: { website: undefined }` would be
    // stored as `null` by the driver, and the two are not the same thing to
    // every reader of the document.
    if (result.value) set[field] = result.value;
    else unset[field] = "";
  }

  /**
   * `avatar` is the one field this route can clear but not set.
   *
   * Setting a picture is `POST /api/profile/avatar`, which uploads the bytes
   * and writes the resulting URL itself — so an avatar is always a URL that
   * came out of Cloudinary, and never a string an author typed. Letting this
   * route write one would open a hole straight through that: point somebody's
   * `<img src>` at anything at all, on every cached profile page, forever.
   */
  if (Object.prototype.hasOwnProperty.call(payload, "avatar")) {
    if (payload.avatar === "") unset.avatar = "";
    else if (typeof payload.avatar !== "string") errors.push("That has to be text.");
    else errors.push("Upload an image to change your profile photo.");
  }

  if (errors.length) {
    return NextResponse.json({ error: errors[0], errors }, { status: 400 });
  }

  const update: Document = {
    $set: { ...set, updatedAt: new Date() },
  };
  if (Object.keys(unset).length) update.$unset = unset;

  await users.updateOne({ _id: account._id }, update);

  return NextResponse.json({
    ok: true,
    item: {
      bio: stored.bio ?? "",
      website: stored.website ?? "",
      twitter: stored.twitter ?? "",
      github: stored.github ?? "",
      // The upload route writes the avatar straight through, so the value this
      // response reports is whatever was already on the account.
      avatar: account.avatar ?? "",
    },
  });
}