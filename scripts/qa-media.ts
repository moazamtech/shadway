import "dotenv/config";
import bcrypt from "bcryptjs";

import { connectToDatabase } from "../lib/mongodb";

/**
 * Component media, end to end.
 *
 * A cover and a demo loop are the two files a listing is judged on, and both go
 * through one route. That route used to accept anything from anyone and sent
 * every file to Cloudinary as an image — so a "demo video" was stored where a
 * `<video>` element cannot play it.
 *
 * This proves the four properties that make the endpoint safe and useful:
 *
 *   - no session, no upload;
 *   - a cover comes back as an `/image/upload/` URL;
 *   - a video comes back as a `/video/upload/` URL and is served back as
 *     `video/mp4` (a range request, which is what a browser does before it
 *     plays);
 *   - the file's own type decides, not the `kind` field, and anything that is
 *     not paint-able media is refused.
 *
 * The video sample is fetched from MDN's CC0 set so the check is a real MP4
 * rather than a fixture Cloudinary would have to take on faith.
 *
 * Run with a dev server up:
 *   npx tsx scripts/qa-media.ts
 */

const BASE = process.env.BASE ?? "http://localhost:3000";
const PASSWORD = "qa-media-1234";
const SAMPLE_VIDEO =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const jar: Record<string, string> = {};

async function request(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const cookie = Object.entries(jar)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
  if (cookie) headers.set("cookie", cookie);

  const response = await fetch(`${BASE}${path}`, { ...init, headers, redirect: "manual" });
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const index = pair.indexOf("=");
    if (index > 0) jar[pair.slice(0, index).trim()] = pair.slice(index + 1).trim();
  }
  return response;
}

let failures = 0;
function log(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  ${extra}` : ""}`);
  if (!ok) failures += 1;
}

function mediaBody(bytes: Uint8Array, type: string, filename: string, kind: string) {
  // A copy over a fresh ArrayBuffer: the Blob constructor does not accept a
  // view whose backing buffer could be a SharedArrayBuffer.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const form = new FormData();
  form.append("file", new Blob([copy], { type }), filename);
  form.append("kind", kind);
  return form;
}

async function main() {
  const { db } = await connectToDatabase();
  const suffix = Math.random().toString(36).slice(2, 8);
  const email = `qa-media-${suffix}@shadway.test`;
  const users = db.collection("users");

  try {
    await users.insertOne({
      email,
      password: await bcrypt.hash(PASSWORD, 12),
      name: "QA Media",
      username: `qa-media-${suffix}`,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const csrf = await (await request("/api/auth/csrf")).json();
    await request("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        csrfToken: csrf.csrfToken,
        email,
        password: PASSWORD,
        callbackUrl: `${BASE}/`,
        json: "true",
      }).toString(),
    });

    const session = await (await request("/api/auth/session")).json().catch(() => ({}));
    log("a publisher signs in", Boolean(session?.user?.id));

    /**
     * The endpoint writes to the deployment's own bucket, so the first thing it
     * has to do is refuse to do that for a stranger.
     */
    const anonymous = await fetch(`${BASE}/api/components/upload-media`, {
      method: "POST",
      body: mediaBody(PNG, "image/png", "cover.png", "image"),
    });
    log("an anonymous upload is refused", anonymous.status === 401, `status=${anonymous.status}`);

    const cover = await request("/api/components/upload-media", {
      method: "POST",
      body: mediaBody(PNG, "image/png", "cover.png", "image"),
    });
    const coverBody = (await cover.json().catch(() => ({}))) as { url?: string };
    log(
      "a cover uploads as an image",
      cover.status === 200 && /\/image\/upload\//.test(coverBody.url ?? ""),
      `status=${cover.status}`,
    );

    const sample = await fetch(SAMPLE_VIDEO).catch(() => null);
    if (!sample?.ok) {
      log("the sample video is reachable", false);
    } else {
      const video = new Uint8Array(await sample.arrayBuffer());
      const uploaded = await request("/api/components/upload-media", {
        method: "POST",
        body: mediaBody(video, "video/mp4", "demo.mp4", "video"),
      });
      const uploadedBody = (await uploaded.json().catch(() => ({}))) as { url?: string };

      log(
        "a demo video uploads as a video",
        uploaded.status === 200 && /\/video\/upload\//.test(uploadedBody.url ?? ""),
        `status=${uploaded.status}`,
      );

      if (uploadedBody.url) {
        // Range, not a full GET: that is the request a `<video>` makes first,
        // and it is the one Cloudinary has to be able to answer.
        const played = await fetch(uploadedBody.url, { headers: { Range: "bytes=0-1023" } });
        log(
          "the stored video is served back as video",
          played.ok && (played.headers.get("content-type") ?? "").startsWith("video/"),
          `status=${played.status} type=${played.headers.get("content-type")}`,
        );
      }

      const mislabelled = await request("/api/components/upload-media", {
        method: "POST",
        body: mediaBody(PNG, "image/png", "cover.png", "video"),
      });
      log("an image sent as a video is refused", mislabelled.status === 415, `status=${mislabelled.status}`);
    }

    const html = await request("/api/components/upload-media", {
      method: "POST",
      body: mediaBody(Buffer.from("<script>alert(1)</script>"), "text/html", "x.html", "image"),
    });
    log("HTML is not media", html.status === 415, `status=${html.status}`);
  } finally {
    await users.deleteMany({ email }).catch(() => {});
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
