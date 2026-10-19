import { describe, expect, it } from "vitest";

import {
  AVATAR_ACCEPT,
  AVATAR_MIME_TYPES,
  MAX_AVATAR_BYTES,
  avatarMessage,
  avatarProblem,
  avatarPublicId,
  type AvatarProblem,
} from "@/lib/profile-avatar";

/**
 * The rules a profile picture follows.
 *
 * They run twice — in the browser before the request, and at the endpoint —
 * so these tests are about the two sides agreeing rather than about any single
 * check passing.
 */
describe("avatarProblem", () => {
  it("takes what a browser would actually hand over", () => {
    for (const type of AVATAR_MIME_TYPES) {
      expect(avatarProblem({ type, size: 200_000 }), type).toBeNull();
    }
  });

  /**
   * An allow-list, not a deny-list. `image/svg+xml` is an allow-list miss on
   * purpose: an SVG carries script, and an `<img src>` is not a context that
   * reliably neutralises it.
   */
  it("refuses types it does not know, including SVG", () => {
    for (const type of ["image/svg+xml", "application/pdf", "text/html", "", "PHOTO"]) {
      expect(avatarProblem({ type, size: 1000 }), type).toBe("type");
    }
  });

  it("does not care what the file is called", () => {
    expect(avatarProblem({ type: "image/png", size: 1000 })).toBeNull();
  });

  it("refuses a file bigger than the cap", () => {
    expect(avatarProblem({ type: "image/png", size: MAX_AVATAR_BYTES })).toBeNull();
    expect(avatarProblem({ type: "image/png", size: MAX_AVATAR_BYTES + 1 })).toBe(
      "too-large",
    );
  });

  it("refuses an empty file", () => {
    expect(avatarProblem({ type: "image/png", size: 0 })).toBe("empty");
  });

  it("refuses what it cannot even measure", () => {
    // A body carrying no size must not pass as "small enough". Which refusal
    // it gets does not matter — what matters is that it does not pass.
    expect(avatarProblem({ type: "image/png" })).not.toBeNull();
    expect(avatarProblem({} as { type?: string })).not.toBeNull();
  });

  it("has a sentence for every problem", () => {
    for (const problem of ["type", "empty", "too-large"] as AvatarProblem[]) {
      expect(avatarMessage(problem), problem).toBeTruthy();
    }
  });
});

describe("AVATAR_ACCEPT", () => {
  it("is the same list, so the file picker and the check cannot drift", () => {
    expect(AVATAR_ACCEPT).toBe(AVATAR_MIME_TYPES.join(","));
  });
});

describe("avatarPublicId", () => {
  /**
   * The bug this whole function exists to prevent.
   *
   * `uploadBufferToCloudinary` passes `overwrite: true`, so the public id *is*
   * the identity of the asset — whoever uploads to it replaces what was there.
   * A shared id means the second account to set a picture silently overwrites
   * the first account's, and nothing reports an error: both uploads succeed and
   * the profile page is simply wrong.
   */
  it("gives two accounts two different targets", () => {
    expect(avatarPublicId("65f0000000000000000000aa")).not.toBe(
      avatarPublicId("65f0000000000000000000bb"),
    );
  });

  /** ...and one account the same target every time, so a re-upload replaces. */
  it("is stable for one account", () => {
    expect(avatarPublicId("65f0000000000000000000aa")).toBe(
      avatarPublicId("65f0000000000000000000aa"),
    );
  });

  it("keeps off the characters Cloudinary reads as path syntax", () => {
    // A slash here would create a nested folder instead of an asset, and a
    // space or a dot-in-the-middle would silently change the id.
    expect(avatarPublicId("65f0000000000000000000aa")).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});