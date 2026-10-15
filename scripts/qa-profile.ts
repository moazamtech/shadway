import "dotenv/config";

/**
 * End-to-end coverage of the profile surfaces:
 *
 *   - registration mints a public handle
 *   - /profile renders for the owner, even with zero work
 *   - publishing attributes the item to that same handle
 *   - /profile lists the item, /u/<handle> shows it to visitors
 *   - the bundles tab renders its empty state
 *   - the saved tab round-trips a bookmark
 *   - an unknown handle 404s
 *
 * Run with a dev server up:
 *   npx tsx scripts/qa-profile.ts
 */

import { connectToDatabase } from "../lib/mongodb";
import { planUsername } from "../lib/db/users";
import bcrypt from "bcryptjs";

const BASE = process.env.BASE ?? "http://localhost:3000";

type CookieJar = Record<string, string>;
const jar: CookieJar = {};

function cookieHeader() {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function collectCookies(res: Response) {
  const raw: string[] =
    typeof (res.headers as any).getSetCookie === "function"
      ? (res.headers as any).getSetCookie()
      : [];
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
  const email = `qa-profile-${suffix}@shadway.test`;
  const password = "qa-password-1234";
  const title = `QA Profile Card ${suffix}`;
  let slug: string | null = null;

  try {
    // --- register the way a real visitor would ---------------------------
    let handle: string | null = null;
    const regRes = await fetch(`${BASE}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: "QA Profile" }),
    });

    if (regRes.status === 201) {
      const data = await regRes.json();
      handle = data.username ?? null;
      log("register mints a handle", Boolean(handle), `username=${handle}`);
    } else if (regRes.status === 429) {
      // The auth rate limiter already saw a run — seed instead, using the
      // same allocator the register route uses.
      handle = await planUsername(email, "QA Profile");
      await db.collection("users").insertOne({
        email,
        password: await bcrypt.hash(password, 12),
        name: "QA Profile",
        username: handle,
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      log("register rate-limited; seeded with the same allocator", true, `username=${handle}`);
    } else {
      throw new Error(`register: ${regRes.status} ${await regRes.text()}`);
    }
    if (!handle) throw new Error("no handle");

    await login(email, password);
    const sessionRes = await request("/api/auth/session");
    const sessionJson = await sessionRes.json().catch(() => ({}));
    log("session resolves", Boolean(sessionJson?.user?.id), `id=${sessionJson?.user?.id}`);

    // --- the owner's profile renders before any work exists --------------
    const profileRes = await request("/profile");
    const profileHtml = await profileRes.text();
    log("/profile renders", profileRes.status === 200, `status=${profileRes.status}`);
    // React splits `@{handle}` into two SSR text nodes, so assert the handle
    // itself; the `@` prefix is part of the same paragraph in the DOM.
    log("/profile names the handle", profileHtml.includes(handle));
    log(
      "/profile shows all three tabs",
      profileHtml.includes("Components") &&
        profileHtml.includes("Bundles") &&
        profileHtml.includes("Saved")
    );
    log(
      "/profile shows the empty state instead of 404ing",
      profileHtml.includes("Nothing published yet")
    );

    // --- publish as this account -----------------------------------------
    const pubRes = await request("/api/components", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: "A profile-page QA fixture.",
        code: [
          "export function QaProfileCard() {",
          `  return <span>${title}</span>;`,
          "}",
        ].join("\n"),
        category: "ui",
        tags: ["qa", "profile"],
      }),
    });
    const pubBody = await pubRes.json().catch(() => ({}));
    slug = pubBody?.item?.slug ?? null;
    const authorUsername = pubBody?.item?.author?.username ?? null;
    log("publish succeeds", pubRes.status === 201 && Boolean(slug), `slug=${slug}`);
    log(
      "publish is attributed to the profile's handle",
      authorUsername === handle,
      `author=${authorUsername} handle=${handle}`
    );

    // --- the owner sees it on /profile -----------------------------------
    const mine = await request("/profile?tab=components");
    const mineHtml = await mine.text();
    log("/profile lists the published component", mineHtml.includes(title));

    // --- visitors see it on the public profile ---------------------------
    const publicRes = await fetch(`${BASE}/u/${handle}`);
    const publicHtml = await publicRes.text();
    log("/u/<handle> renders", publicRes.status === 200, `status=${publicRes.status}`);
    log("public profile lists the component", publicHtml.includes(title));
    log("public profile names the author", publicHtml.includes("QA Profile"));

    const bundleTab = await fetch(`${BASE}/u/${handle}?tab=bundles`);
    const bundleHtml = await bundleTab.text();
    log(
      "/u/<handle>?tab=bundles renders its empty state",
      bundleTab.status === 200 && bundleHtml.includes("No bundles yet")
    );

    // --- the saved tab round-trips a bookmark ----------------------------
    const bmRes = await request("/api/components/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    log("bookmark saves", bmRes.ok);
    const savedTab = await request("/profile?tab=saved");
    const savedHtml = await savedTab.text();
    log("/profile?tab=saved lists the bookmark", savedHtml.includes(title));

    // --- an unknown handle is a real 404 ---------------------------------
    const missing = await fetch(`${BASE}/u/qa-missing-${suffix}`);
    log("unknown handle 404s", missing.status === 404, `status=${missing.status}`);
  } finally {
    if (slug) {
      await db.collection("components").deleteMany({ slug });
      await db.collection("component_bookmarks").deleteMany({ slug });
      await db.collection("component_votes").deleteMany({ slug });
    }
    await db.collection("users").deleteMany({ email });
  }

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
