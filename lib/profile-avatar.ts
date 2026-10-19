/**
 * The rules a profile picture follows.
 *
 * ## Why this file exists
 *
 * The browser and the server have to agree twice here, and neither check can
 * live on only one side:
 *
 * 1. **Before the request.** A phone photo is five megabytes. Refusing it in
 *    the browser turns a mistake into a sentence under the input instead of a
 *    thirty-second upload that fails anyway.
 * 2. **At the endpoint.** A check the client can skip is not a check. The same
 *    size and type rules run again on the way in, from this module, so the
 *    numbers below are the only numbers in the codebase.
 *
 * It also holds the rule that makes an avatar *safe*: the upload target is
 * derived from the account, never shared.
 */

/**
 * Deliberately well under the 10 MB the component media route allows. An
 * avatar is painted at 96px on the profile and 32px in the navbar, so anything
 * past this is bytes nobody will ever see.
 */
export const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

/**
 * An allow-list, not a deny-list. Cloudinary can transcode far more than this;
 * the point is that the *browser* refuses to upload an SVG, and a server-side
 * `image/*` check would happily wave one through.
 */
export const AVATAR_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

/** Ready for the `accept` attribute, so the two lists cannot drift apart. */
export const AVATAR_ACCEPT = AVATAR_MIME_TYPES.join(",");

export const AVATAR_FOLDER = "shadway/avatars";

export type AvatarProblem = "type" | "empty" | "too-large";

const MESSAGES: Record<AvatarProblem, string> = {
  empty: "Choose an image first.",
  type: "Use a PNG, JPEG, WebP, GIF or AVIF image.",
  "too-large": `Keep it under ${Math.round(MAX_AVATAR_BYTES / 1024 / 1024)} MB.`,
};

/** What a problem means, or null when the file may be uploaded. */
export function avatarProblem(file: {
  type?: string;
  size?: number;
}): AvatarProblem | null {
  const type = (file.type || "").toLowerCase();
  const size = file.size ?? 0;
  if (!type || !(AVATAR_MIME_TYPES as readonly string[]).includes(type)) return "type";
  if (size <= 0) return "empty";
  if (size > MAX_AVATAR_BYTES) return "too-large";
  return null;
}

export function avatarMessage(problem: AvatarProblem): string {
  return MESSAGES[problem];
}

/**
 * The Cloudinary public id an account's picture is written to.
 *
 * `uploadBufferToCloudinary` passes `overwrite: true`, so the id *is* the
 * identity of the asset: whoever uploads to this id replaces whatever is
 * there. That is what makes a re-upload free — no orphan per attempt — and it
 * is exactly why the id has to be per-account. A shared id (`Date.now()`, a
 * constant, the bare filename) means the second person to set a picture
 * silently replaces the first person's, and nobody sees an error: both uploads
 * succeed, and the profile page is just wrong.
 *
 * Keyed on the account, not on the filename, so it is stable across attempts
 * and unique across accounts. `avatar-<mongo id>` — the id is unique, already
 * public on every published component, and free of the characters Cloudinary
 * treats specially in a public id.
 */
export function avatarPublicId(accountId: string): string {
  return `avatar-${accountId}`;
}