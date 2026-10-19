import "dotenv/config";

/**
 * End-to-end coverage of the profile surfaces:
 *
 *   - registration mints a public handle
 *   - /profile is a redirect to /u/<handle>, and that page renders for the
 *     owner even with zero work
 *   - publishing attributes the item to that same handle
 *   - the profile lists the item, and so does the same URL for a visitor
 *   - the tabs partition the work by the taxonomy's groups
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
  /**
   * `getSetCookie()` exists on undici's `Headers` but not in the DOM lib's
   * type, which is what this script compiles against. A structural cast keeps
   * the call honest — `any` here would also have accepted a typo, and a silently
   * empty cookie jar reads as "the login failed" three assertions later.
   */
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

/**
 * Follow redirects the way a browser would, and report where they landed.
 *
 * `request` is manual on purpose — the auth flow is asserted by its status
 * codes, so following redirects silently would hide the thing under test. The
 * profile addresses need the opposite: `/profile` is a 307 to the canonical
 * `/u/<handle>`, and the assertions below are about the page a reader ends up
 * on, not about the hop. Returning the final path is what lets a test say *which*
 * profile it landed on — asserting only `status === 200` would pass on somebody
 * else's page.
 */
async function follow(
  path: string,
  max = 3
): Promise<{ res: Response; html: string; path: string }> {
  let current = path;
  for (let hop = 0; hop < max; hop += 1) {
    const res = await request(current);
    if (res.status < 300 || res.status >= 400) {
      return { res, html: await res.text(), path: current };
    }
    const location = res.headers.get("location");
    if (!location) return { res, html: await res.text(), path: current };
    const next = new URL(location, BASE);
    current = `${next.pathname}${next.search}`;
  }
  throw new Error(`more than ${max} redirects from ${path}`);
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
    const redirect = await request("/profile");
    log(
      "/profile is a redirect, not a page",
      redirect.status === 307,
      `status=${redirect.status}`
    );
    const target = redirect.headers.get("location") ?? "";
    log(
      "/profile redirects to the canonical profile",
      new URL(target, BASE).pathname === `/u/${handle}`,
      `location=${target}`
    );

    const owner = await follow("/profile");
    log(
      "the canonical profile renders",
      owner.res.status === 200,
      `status=${owner.res.status} path=${owner.path}`
    );
    // React splits `@{handle}` into two SSR text nodes, so assert the handle
    // itself; the `@` prefix is part of the same paragraph in the DOM.
    log("the profile names the handle", owner.html.includes(handle));
    log(
      "the profile shows both work tabs",
      owner.html.includes("Components") && owner.html.includes("Blocks")
    );
    log(
      "the profile shows the owner's empty state instead of 404ing",
      // The owner reads "You haven't…" where a visitor reads "Nothing…", so the
      // assertion has to name the one this request actually gets — asserting the
      // visitor's wording passed nothing and hid the moderation behaviour below.
      owner.html.includes("You haven't published anything yet")
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

    // --- publishing does not publish -------------------------------------
    /**
     * A regular account's publish *submits* it. The route writes
     * `status: "pending"` and an admin approves it, so a component from a
     * non-admin is deliberately absent from every public surface until then.
     *
     * This is asserted, not worked around: it is the boundary that keeps the
     * marketplace from being a place anyone can write to directly, and a QA
     * script that skipped it — by publishing as an admin, or by only checking the
     * API response — would report the feature working while the profile was
     * empty. Which is exactly what this script used to do.
     */
    const pendingPublic = await fetch(`${BASE}/u/${handle}`);
    const pendingHtml = await pendingPublic.text();
    log(
      "a pending submission is not on the profile yet",
      !pendingHtml.includes(title),
      `slug=${slug}`
    );

    const pendingOwner = await follow("/profile?tab=components");
    log(
      "nor on the owner's own view of it",
      !pendingOwner.html.includes(title)
    );

    // --- approve it, the way an admin would ------------------------------
    // Through the database rather than the admin API because this script signs in
    // as an ordinary account: it is asserting what approval *enables*, and the
    // approval route itself is `scripts/qa-admin.ts`'s subject.
    await db
      .collection("components")
      .updateOne(
        { slug },
        { $set: { status: "published", publishedAt: new Date() } }
      );
    // --- and now it is on both profiles ----------------------------------
    const mine = await follow("/profile?tab=components");
    log(
      "the profile lists the published component",
      mine.html.includes(title),
      `path=${mine.path}`
    );
    log(
      "the Components tab is the one the redirect landed on",
      mine.path === `/u/${handle}?tab=components`,
      `path=${mine.path}`
    );

    // --- visitors see it on the public profile ---------------------------
    const publicRes = await fetch(`${BASE}/u/${handle}`);
    const publicHtml = await publicRes.text();
    log("/u/<handle> renders", publicRes.status === 200, `status=${publicRes.status}`);
    log("public profile lists the component", publicHtml.includes(title));
    log("public profile names the author", publicHtml.includes("QA Profile"));

    // The Blocks tab holds landing-page sections, and this account has published
    // none — so it is the tab's own empty state, not the Components one. Read as
    // a visitor (no cookie), because the owner's copy says "you haven't".
    const blocksTab = await fetch(`${BASE}/u/${handle}?tab=blocks`);
    const blocksHtml = await blocksTab.text();
    log(
      "/u/<handle>?tab=blocks renders its empty state",
      blocksTab.status === 200 && blocksHtml.includes("No blocks yet")
    );

    // --- the saved tab round-trips a bookmark ----------------------------
    const bmRes = await request("/api/components/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    log("bookmark saves", bmRes.ok);
    const savedTab = await follow("/profile?tab=saved");
    log(
      "the saved tab survives the redirect",
      savedTab.path === `/u/${handle}?tab=saved`,
      `path=${savedTab.path}`
    );
    log("the saved tab lists the bookmark", savedTab.html.includes(title));

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
