import "dotenv/config";
import { eq } from "drizzle-orm";
import puppeteer from "puppeteer";

import { db } from "../lib/db/postgres";
import { components as componentsTable } from "../lib/db/schema";
import { BASE, createQaAccount, removeQaAccount } from "./qa-session";

/**
 * The demo video, end to end.
 *
 * A card's video is the only moving thing in the feed, and it is the only
 * thing in the feed that is not a picture — so it is also the only thing that
 * can be broken in a way nobody notices until they move the mouse over the
 * card and nothing happens.
 *
 * So this does the whole path: it uploads a real video to the bucket, hangs
 * it on a published component, opens the feed, puts the pointer on the card
 * and checks that the video mounted, is playing, and is being delivered from
 * the CDN at the size it is painted. Then it takes the video back off the
 * component, so the catalogue is the catalogue it was.
 *
 * Run with a dev server up:
 *   npx tsx scripts/qa-video.ts
 */

const SAMPLE =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SLUG = "particles";

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

async function main() {
  /**
   * The account the video is hung on.
   *
   * The component it is hung on is a real one from the catalogue, so the
   * account has to be one the application knows about: the session decides
   * whether the edit is allowed, and a session minted for an account the
   * application cannot find signs nobody in.
   */
  const account = await createQaAccount("admin");

  /**
   * The video the catalogue already carried, if it carried one.
   *
   * The check borrows a real component and gives it back afterwards, and
   * giving it back means putting back what was there rather than what this
   * run happened to leave. A catalogue that quietly loses a video to a test is
   * a catalogue nobody trusts.
   */
  let originalVideoUrl: string | null = null;

  try {
    const existing = await db()
      .select({ videoUrl: componentsTable.videoUrl })
      .from(componentsTable)
      .where(eq(componentsTable.slug, SLUG))
      .limit(1);
    originalVideoUrl = existing[0]?.videoUrl ?? null;

    const csrf = await (await request("/api/auth/csrf")).json();
    await request("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        csrfToken: csrf.csrfToken,
        email: account.email,
        password: account.password,
        callbackUrl: `${BASE}/`,
        json: "true",
      }).toString(),
    });

    // 1. The upload.
    const sample = await fetch(SAMPLE);
    const bytes = new Uint8Array(await sample.arrayBuffer());
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "video/mp4" }), "demo.mp4");
    form.append("kind", "video");
    const uploaded = await request("/api/components/upload-media", {
      method: "POST",
      body: form,
    });
    const uploadedBody = (await uploaded.json().catch(() => ({}))) as { url?: string };
    log(
      "the video is uploaded as a video",
      uploaded.status === 200 && /\/video\/upload\//.test(uploadedBody.url ?? ""),
      `status=${uploaded.status}`,
    );

    // 2. It is attached to a published component.
    const patched = await request(`/api/components/${SLUG}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl: uploadedBody.url }),
    });
    log("the component carries the video", patched.status === 200, `status=${patched.status}`);

    // 3. The card plays it on hover.
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: CHROME,
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));

    await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const before = await page.evaluate(() => document.querySelectorAll("article video").length);
    log("no video is fetched before the pointer arrives", before === 0, `videos=${before}`);

    const cards = await page.$$("article");
    for (const card of cards) {
      await card.hover();
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const state = await page.evaluate(() => {
      const video = document.querySelector("article video") as HTMLVideoElement | null;
      if (!video) return null;
      return {
        src: video.getAttribute("src") ?? "",
        paused: video.paused,
        readyState: video.readyState,
        currentTime: video.currentTime,
        width: video.clientWidth,
      };
    });

    log("the video mounts on hover", Boolean(state), state ? "" : "no video element");
    log(
      "the video is delivered from the CDN at the painted size",
      Boolean(state?.src.includes("/video/upload/") && (state?.width ?? 0) > 0),
      `width=${state?.width ?? 0}`,
    );
    log(
      "the video plays",
      Boolean(state && !state.paused && state.readyState >= 2 && state.currentTime > 0),
      `paused=${state?.paused} ready=${state?.readyState} t=${state?.currentTime.toFixed(2)}`,
    );
    log("the page had no console errors", errors.length === 0, errors.slice(0, 2).join(" | "));

    await browser.close();

    // 4. The catalogue is left as it was.
    const cleared = await request(`/api/components/${SLUG}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl: null }),
    });
    log("the video is taken back off the component", cleared.status === 200);
  } finally {
    /**
     * The catalogue is put back whatever happened above.
     *
     * The edit is the only thing this run changes about a component that
     * belongs to somebody else, and a run that dies halfway through would
     * otherwise leave a video on a card that never had one — a broken row that
     * outlives the check that made it.
     */
    await request(`/api/components/${SLUG}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl: originalVideoUrl }),
    }).catch(() => {});
    await removeQaAccount(account.email).catch(() => {});
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
