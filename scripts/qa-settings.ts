import "dotenv/config";

/**
 * End-to-end coverage of what an author can change about their public profile:
 *
 *   - /settings offers a picture, a website and a GitHub link
 *   - a bare host is stored as a real `https://` address, and renders as one
 *   - `javascript:` is refused, and refusing it changes nothing
 *   - fields the route does not own (`role`) have nowhere to land
 *   - clearing a field removes it from the profile, not just from the form
 *   - a picture goes through the upload endpoint, and only through it
 *
 * Run with a dev server up:
 *   npx tsx scripts/qa-settings.ts
 */

import { connectToDatabase } from "../lib/mongodb";
import { planUsername } from "../lib/db/users";
import { isCloudinaryConfigured } from "../lib/cloudinary";
import { avatarPublicId } from "../lib/profile-avatar";
import bcrypt from "bcryptjs";

const BASE = process.env.BASE ?? "http://localhost:3000";

/** A 1×1 transparent PNG: enough for Cloudinary, small enough to inline. */
const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

type CookieJar = Record<string, string>;
const jar: CookieJar = {};

function cookieHeader() {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function collectCookies(res: Response) {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw: string[] =
    typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const cookie of raw) {
    const first = cookie.split(";")[0];
    const idx = first.indexOf("=");
    if (idx <= 0) continue;
    jar[first.slice(0, idx).trim()] = first.slice(idx + 1).trim();
  }
}

async function request(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("cookie", cookieHeader());
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    redirect: "manual",
  });
  collectCookies(res);
  return res;
}

function patch(body: unknown) {
  return request("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function login(email: string, password: string) {
  const csrfRes = await request("/api/auth/csrf");
  const csrf = await csrfRes.json();

  const params = new URLSearchParams();
  params.set("csrfToken", csrf.csrfToken);
  params.set("email", email);
  params.set("password", password);
  params.set("callbackUrl", `${BASE}/`);
  params.set("json", "true");

  await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
}

let failures = 0;
function log(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  ${extra}` : ""}`);
  if (!ok) failures += 1;
}

async function main() {
  const { db } = await connectToDatabase();
  const suffix = Math.random().toString(36).slice(2, 8);
  const email = `qa-settings-${suffix}@shadway.test`;
  const password = "qa-password-1234";
  const changedPassword = "changed-password-9876";
  const name = `QA Settings ${suffix}`;

  const users = db.collection("users");

  try {
    // --- an account, the way a visitor makes one -------------------------
    let handle: string | null = null;
    const regRes = await fetch(`${BASE}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    if (regRes.status === 201) {
      handle = (await regRes.json()).username ?? null;
    } else if (regRes.status === 429) {
      handle = await planUsername(email, name);
      await users.insertOne({
        email,
        password: await bcrypt.hash(password, 12),
        name,
        username: handle,
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      throw new Error(`register: ${regRes.status} ${await regRes.text()}`);
    }
    if (!handle) throw new Error("no handle");
    log("account exists", true, `username=${handle}`);

    await login(email, password);
    const sessionRes = await request("/api/auth/session");
    const sessionJson = await sessionRes.json().catch(() => ({}));
    log("session resolves", Boolean(sessionJson?.user?.id));
    const userId = sessionJson?.user?.id as string;
    log(
      "session carries the handle without a round trip",
      sessionJson?.user?.username === handle,
      `session=${sessionJson?.user?.username}`
    );

    // --- the account form: name and password -----------------------------
    /**
     * These four checks were this script before it grew a profile section, and
     * they are the ones that matter most: the endpoint they exercise re-verifies
     * a secret, and the only proof a password change worked is that the *new*
     * password signs in. The previous version asserted the status of the earlier
     * login instead — a green check that could never go red.
     */
    const meRes = await request("/api/me");
    const me = await meRes.json().catch(() => ({}));
    log(
      "GET /api/me returns the account",
      meRes.status === 200 && me?.item?.email === email,
      `email=${me?.item?.email}`
    );

    const renameRes = await request("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Renamed QA" }),
    });
    log("the display name can be changed", renameRes.status === 200, `status=${renameRes.status}`);
    const renamed = await (await request("/api/me")).json().catch(() => ({}));
    log(
      "the new name persists",
      renamed?.item?.name === "Renamed QA",
      `name=${renamed?.item?.name}`
    );

    const wrongCurrent = await request("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "definitely-not-it", newPassword: changedPassword }),
    });
    log(
      "a password change needs the current password",
      wrongCurrent.status === 400,
      `status=${wrongCurrent.status}`
    );

    const changeRes = await request("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: password, newPassword: changedPassword }),
    });
    log("the password can be changed", changeRes.status === 200, `status=${changeRes.status}`);

    // Start from a clean jar so this is a real sign-in, not the old session.
    for (const key of Object.keys(jar)) delete jar[key];
    await login(email, changedPassword);
    const relog = await request("/api/auth/session");
    const relogJson = await relog.json().catch(() => ({}));
    log(
      "the new password signs in",
      relogJson?.user?.email === email,
      `email=${relogJson?.user?.email}`
    );

    // --- the form the author is asked to fill in -------------------------
    const settingsRes = await request("/settings");
    const settingsHtml = await settingsRes.text();
    log("/settings renders", settingsRes.status === 200, `status=${settingsRes.status}`);
    log(
      "/settings offers a picture, a website and a GitHub link",
      settingsHtml.includes("Upload photo") &&
        settingsHtml.includes("Website") &&
        settingsHtml.includes("GitHub")
    );
    log(
      "/settings offers a bio",
      settingsHtml.includes("Bio")
    );

    // --- a bare host becomes a real address ------------------------------
    const writeRes = await patch({
      bio: "  Building   things.\n\nAnd other things.  ",
      website: "example.com",
      github: "octocat",
    });
    const written = await writeRes.json().catch(() => ({}));
    log("profile links save", writeRes.status === 200, `status=${writeRes.status}`);
    log(
      "a bare host is stored as https",
      typeof written.item?.website === "string" &&
        written.item.website.startsWith("https://example.com"),
      `website=${written.item?.website}`
    );
    log(
      "a bare GitHub login becomes a profile URL",
      typeof written.item?.github === "string" &&
        written.item.github.startsWith("https://github.com/octocat"),
      `github=${written.item?.github}`
    );
    log(
      "a bio is collapsed to one line",
      written.item?.bio === "Building things. And other things.",
      `bio=${JSON.stringify(written.item?.bio)}`
    );

    // --- and the profile renders them as links ---------------------------
    const profileAfter = await (await fetch(`${BASE}/u/${handle}`)).text();
    log(
      "the profile links to the website",
      profileAfter.includes(`href="${written.item.website}"`),
      `href=${written.item.website}`
    );
    log(
      "the profile links to GitHub",
      profileAfter.includes(`href="${written.item.github}"`),
      `href=${written.item.github}`
    );
    log("the profile shows the bio", profileAfter.includes("Building things."));

    // --- a `javascript:` link is refused and changes nothing -------------
    const storedBefore = await users.findOne({ email });
    const evil = await patch({ website: "javascript:alert(document.cookie)" });
    const evilBody = await evil.json().catch(() => ({}));
    log("a javascript: link is refused", evil.status === 400, `status=${evil.status}`);
    log(
      "the refusal says what is wrong",
      typeof evilBody.error === "string" && evilBody.error.length > 0,
      `error=${evilBody.error}`
    );
    const storedAfter = await users.findOne({ email });
    log(
      "a refused link does not overwrite the stored one",
      storedAfter?.website === storedBefore?.website,
      `website=${storedAfter?.website}`
    );

    // --- fields the route does not own have nowhere to land --------------
    const escalate = await patch({
      role: "admin",
      username: "admin",
      email: "someone-else@example.test",
      password: "hunter2-hunter2",
      __proto__: { role: "admin" },
    });
    log("an unknown field is not an error", escalate.status === 200, `status=${escalate.status}`);
    const afterEscalate = await users.findOne({ email });
    log(
      "role cannot be written through the profile route",
      afterEscalate?.role === "user",
      `role=${afterEscalate?.role}`
    );
    log(
      "neither can the handle or the email",
      afterEscalate?.username === handle && afterEscalate?.email === email
    );

    // --- clearing removes it from the page -------------------------------
    const clearRes = await patch({ website: "", github: "" });
    log("fields can be cleared", clearRes.status === 200, `status=${clearRes.status}`);
    const afterClear = await users.findOne({ email });
    log(
      "cleared means absent, not an empty string",
      afterClear?.website === undefined && afterClear?.github === undefined,
      `website=${String(afterClear?.website)}`
    );
    const profileCleared = await (await fetch(`${BASE}/u/${handle}`)).text();
    log(
      "the profile stops linking to them",
      !profileCleared.includes(written.item.website) &&
        !profileCleared.includes(written.item.github)
    );

    // --- the picture ------------------------------------------------------
    if (!isCloudinaryConfigured()) {
      /**
       * A deployment without a bucket is a supported state, not a broken one:
       * the page still saves the text fields and the upload says so. Assert
       * *that*, rather than skipping — "no assertion ran" reads as a pass.
       */
      const noBucket = await request("/api/profile/avatar", {
        method: "POST",
        body: (() => {
          const form = new FormData();
          form.set("file", new Blob([Buffer.from(PNG_1X1, "base64")], { type: "image/png" }), "a.png");
          return form;
        })(),
      });
      const body = await noBucket.json().catch(() => ({}));
      log(
        "without a bucket the upload degrades instead of 500ing",
        noBucket.status === 503 && body.degraded === true,
        `status=${noBucket.status}`
      );
    } else {
      // A file the browser would refuse must be refused again here: the client
      // check is a courtesy, and a request can skip it.
      const textFile = new FormData();
      textFile.set(
        "file",
        new Blob(["not an image"], { type: "text/plain" }),
        "notes.txt"
      );
      const wrongType = await request("/api/profile/avatar", {
        method: "POST",
        body: textFile,
      });
      log(
        "a non-image is refused",
        wrongType.status === 400,
        `status=${wrongType.status}`
      );

      const tooBig = new FormData();
      tooBig.set(
        "file",
        new Blob([Buffer.alloc(4 * 1024 * 1024 + 1)], { type: "image/png" }),
        "huge.png"
      );
      const oversized = await request("/api/profile/avatar", {
        method: "POST",
        body: tooBig,
      });
      log(
        "an oversized image is refused",
        oversized.status === 413,
        `status=${oversized.status}`
      );

      const upload = new FormData();
      upload.set(
        "file",
        new Blob([Buffer.from(PNG_1X1, "base64")], { type: "image/png" }),
        "avatar.png"
      );
      const uploadRes = await request("/api/profile/avatar", {
        method: "POST",
        body: upload,
      });
      const uploaded = await uploadRes.json().catch(() => ({}));
      log(
        "an image uploads",
        // The route answers `{ url }`, which is what the form assigns to both its
        // saved and its draft copy — asserting a different key would have failed
        // against a working endpoint.
        uploadRes.status === 200 && typeof uploaded.url === "string",
        `status=${uploadRes.status}`
      );

      const withAvatar = await users.findOne({ email });
      log(
        "the account stores a Cloudinary URL",
        typeof withAvatar?.avatar === "string" &&
          withAvatar.avatar.includes("res.cloudinary.com"),
        `avatar=${withAvatar?.avatar}`
      );
      log(
        "the public id is derived from the account, not shared",
        typeof withAvatar?.avatar === "string" &&
          withAvatar.avatar.includes(avatarPublicId(userId)),
        `expected=${avatarPublicId(userId)}`
      );

      const profileWithAvatar = await (await fetch(`${BASE}/u/${handle}`)).text();
      const avatarUrl = typeof withAvatar?.avatar === "string" ? withAvatar.avatar : "";
      /**
       * The picture is delivered at the size it is painted, so the page asks
       * the CDN for a smaller copy of the same asset — the URL in the markup
       * is not the URL in the database. What has to be on the page is the
       * asset, and the asset is named by the last segment of its path.
       */
      const asset = avatarUrl.split("/").pop() ?? "";
      log(
        "the profile paints the picture",
        Boolean(asset) && profileWithAvatar.includes(asset),
        `asset=${asset}`
      );

      // A typed URL must not be able to become an avatar.
      const typed = await patch({ avatar: "https://evil.example/x.png" });
      log("an avatar URL cannot be written by hand", typed.status === 400, `status=${typed.status}`);
      const afterTyped = await users.findOne({ email });
      log(
        "the hand-written value did not land",
        afterTyped?.avatar === withAvatar?.avatar
      );

      // Clearing is allowed, and is the one write this route owns.
      const cleared = await patch({ avatar: "" });
      log("the picture can be cleared", cleared.status === 200, `status=${cleared.status}`);
      const afterPictureClear = await users.findOne({ email });
      log("clearing removes the stored picture", afterPictureClear?.avatar === undefined);
    }
  } finally {
    await users.deleteMany({ email });
  }

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
