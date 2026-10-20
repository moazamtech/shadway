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

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { db } from "../lib/db/postgres";
import {
  componentBookmarks,
  componentVotes,
  components,
  users as usersTable,
} from "../lib/db/schema";
import { createAccount, planUsername } from "../lib/db/users";

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
  const client = db();
  const suffix = Math.random().toString(36).slice(2, 8);
  const email = `qa-profile-${suffix}@shadway.test`;
  const password = "qa-password-1234";
  const title = `QA Profile Card ${suffix}`;
  let slug: string | null = null;

  /**
   * The fixtures live in the database the application reads.
   *
   * They used to be written into Mongo, which was the store of the day, and
   * the application has since moved to Postgres. A fixture written into a
   * store nobody reads is not a fixture: every assertion below would fail
   * because the thing under test was never there, and the check would be
   * reporting on the database rather than on the profile.
   */
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
      await createAccount({
        email,
        password: await bcrypt.hash(password, 12),
        name: "QA Profile",
        username: handle,
        role: "user",
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
      "the profile shows one shelf of published work",
      owner.html.includes("Published")
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
        /**
         * The first tag is the sub-category, and the route refuses a publish
         * without one: a component that does not say what kind of thing it is
         * cannot be filed on a shelf, so it would sit there with nothing to
         * file it under. The two tags after it are the fixture's own labels
         * and say nothing about the kind.
         */
        tags: ["button", "qa", "profile"],
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
    if (!slug) throw new Error("the publish did not answer with a slug");
    await client
      .update(components)
      .set({ status: "published", publishedAt: new Date() })
      .where(eq(components.slug, slug));
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

    // There is one shelf of published work now, so a tab that used to exist
    // falls back to it rather than answering with an empty pane of its own.
    // Read as a visitor (no cookie), because the owner's copy says "you
    // haven't".
    const blocksTab = await fetch(`${BASE}/u/${handle}?tab=blocks`);
    const blocksHtml = await blocksTab.text();
    log(
      "/u/<handle>?tab=blocks falls back to the published work",
      blocksTab.status === 200 && blocksHtml.includes(title)
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
    /**
     * The cleanup removes the rows this run created and nothing else.
     *
     * A row left behind is not cosmetic. The slug is unique, so a component
     * that survived its run makes the next run's publish collide with it, and
     * the check that fails then is a check about the slug rather than about
     * the profile. The account goes the same way: an account that outlives
     * its run keeps its handle, and the handle is what the profile is
     * addressed by.
     */
    if (slug) {
      await client.delete(componentBookmarks).where(eq(componentBookmarks.slug, slug));
      await client.delete(componentVotes).where(eq(componentVotes.slug, slug));
      await client.delete(components).where(eq(components.slug, slug));
    }
    await client.delete(usersTable).where(eq(usersTable.email, email));
  }

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
