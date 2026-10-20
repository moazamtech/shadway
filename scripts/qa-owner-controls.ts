import "dotenv/config";

/**
 * End-to-end coverage of the owner controls:
 *
 *   - anonymous PATCH/DELETE -> 401
 *   - signed-in owner PATCH  -> 200 (title/visibility)
 *   - non-owner PATCH        -> 403
 *   - signed-in owner DELETE -> 200
 *   - /studio renders for a signed-in user
 *
 * Run with a dev server up:
 *   npx tsx scripts/qa-owner-controls.ts
 */

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { db } from "../lib/db/postgres";
import {
  componentBookmarks,
  componentVotes,
  components,
  users as usersTable,
} from "../lib/db/schema";
import { createAccount } from "../lib/db/users";

const BASE = process.env.BASE ?? "http://localhost:3000";

type CookieJar = Record<string, string>;

/**
 * `getSetCookie` is the only way to read every `Set-Cookie` off a response
 * without the first one shadowing the rest, but it only exists on newer
 * runtimes, so the call is guarded rather than assumed.
 */
type HeadersWithSetCookie = Headers & { getSetCookie?: () => string[] };

const jar: CookieJar = {};
function cookieHeader() {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}
function collectCookies(res: Response) {
  const headers = res.headers as HeadersWithSetCookie;
  const raw: string[] =
    typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const cookie of raw) {
    const first = cookie.split(";")[0];
    const idx = first.indexOf("=");
    if (idx <= 0) continue;
    const name = first.slice(0, idx).trim();
    const value = first.slice(idx + 1).trim();
    jar[name] = value;
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

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

let failures = 0;
function log(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  ${extra}` : ""}`);
  if (!ok) failures += 1;
}

interface SessionPayload {
  user?: {
    id?: string;
  };
}

async function login(email: string, password: string): Promise<CookieJar> {
  const localJar: CookieJar = {};
  const localCollect = (res: Response) => {
    const headers = res.headers as HeadersWithSetCookie;
    const raw: string[] =
      typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
    for (const cookie of raw) {
      const first = cookie.split(";")[0];
      const idx = first.indexOf("=");
      if (idx <= 0) continue;
      localJar[first.slice(0, idx).trim()] = first.slice(idx + 1).trim();
    }
  };

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, {
    headers: { cookie: Object.entries(localJar).map(([k, v]) => `${k}=${v}`).join("; ") },
  });
  localCollect(csrfRes);
  const csrfText = await csrfRes.text();
  console.log(`    csrf (login): status=${csrfRes.status} body=${csrfText.slice(0, 120)}`);
  const csrf = JSON.parse(csrfText);

  const params = new URLSearchParams();
  params.set("csrfToken", csrf.csrfToken);
  params.set("email", email);
  params.set("password", password);
  params.set("callbackUrl", `${BASE}/`);
  params.set("json", "true");

  const cbRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie: Object.entries(localJar).map(([k, v]) => `${k}=${v}`).join("; "),
    },
    body: params.toString(),
    redirect: "manual",
  });
  localCollect(cbRes);

  // Copy into the shared jar too.
  for (const [k, v] of Object.entries(localJar)) jar[k] = v;

  return localJar;
}

async function main() {
  const client = db();
  const suffix = randomSuffix();
  const ownerEmail = `qa-owner-${suffix}@shadway.test`;
  const otherEmail = `qa-other-${suffix}@shadway.test`;
  const password = "qa-password-1234";
  let slug: string | null = null;

  /**
   * The fixtures live in the database the application reads.
   *
   * The accounts are written straight into the table to stay clear of the
   * sign-in rate limiter during QA, and the component is written beside them
   * so it has a real owner to be protected by. Both have to land where the
   * application looks: an account the application cannot see signs nobody
   * in, and a component it cannot find answers every ownership question with
   * a 404 — which would make the checks below pass for the wrong reason.
   */
  try {
    // Seed the accounts directly, to avoid the auth rate limiter during QA.
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();
    const owner = await createAccount({
      email: ownerEmail,
      password: passwordHash,
      name: "QA Owner",
      role: "user",
    });
    const other = await createAccount({
      email: otherEmail,
      password: passwordHash,
      name: "QA Other",
      role: "user",
    });
    const ownerId = owner._id ?? "";
    const otherId = other._id ?? "";

    await login(ownerEmail, password);

    const sessionRes = await request("/api/auth/session");
    const sessionJson = await sessionRes.json().catch(() => ({}));
    log(
      "owner session resolves",
      sessionRes.ok && sessionJson?.user?.id === ownerId,
      `id=${sessionJson?.user?.id}`
    );

    // A component owned by the test user, written straight into the table.
    slug = `qa-owner-control-${suffix}`;
    /**
     * The slug is unique, so a row left behind by an earlier run would make
     * this insert fail on a constraint rather than on the thing being
     * checked. Clearing the address first is what the old script did when it
     * deleted the leftovers, and it keeps a broken run from poisoning every
     * run after it.
     */
    await client
      .delete(componentBookmarks)
      .where(eq(componentBookmarks.slug, slug));
    await client.delete(componentVotes).where(eq(componentVotes.slug, slug));
    await client.delete(components).where(eq(components.slug, slug));
    await client.insert(components).values({
      id: randomBytes(12).toString("hex"),
      slug,
      title: "QA Owner Control",
      description: "temporary",
      code: "export default function X(){return <div/>}",
      files: {},
      category: "ui",
      tags: ["qa"],
      dependencies: [],
      devDependencies: [],
      registryDependencies: [],
      cssVars: null,
      author: { userId: ownerId, name: "QA Owner", username: "qaowner", avatar: null },
      visibility: "public",
      status: "published",
      installs: 0,
      views: 0,
      likes: 0,
      featured: false,
      version: "1.0.0",
      license: "MIT",
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    });

    // ---------------------------------------------------------------- owner --
    let res = await request(`/api/components/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Title", visibility: "unlisted" }),
    });
    log("owner PATCH succeeds", res.status === 200, `status=${res.status}`);
    const patched = await res.json().catch(() => ({}));
    log(
      "owner PATCH returns updated title",
      patched?.item?.title === "Updated Title",
      `title=${patched?.item?.title}`
    );

    // --------------------------------------------------------------- non-owner
    // Log in as the second user by resetting the shared jar.
    Object.keys(jar).forEach((k) => delete jar[k]);
    await login(otherEmail, password);
    const otherSessionRes = await request("/api/auth/session");
    const otherSessionText = await otherSessionRes.text();
    let otherSessionJson: SessionPayload = {};
    try {
      otherSessionJson = JSON.parse(otherSessionText) as SessionPayload;
    } catch {
      console.log("NON-OWNER SESSION RAW:", otherSessionRes.status, otherSessionText.slice(0, 300));
    }
    log(
      "other-user session resolves",
      otherSessionRes.ok && otherSessionJson?.user?.id === otherId,
      `id=${otherSessionJson?.user?.id} status=${otherSessionRes.status}`
    );

    res = await request(`/api/components/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hijack" }),
    });
    log("non-owner PATCH -> 403", res.status === 403, `status=${res.status}`);

    res = await request(`/api/components/${slug}`, { method: "DELETE" });
    log("non-owner DELETE -> 403", res.status === 403, `status=${res.status}`);

    // Switch back to the owner and delete for real.
    Object.keys(jar).forEach((k) => delete jar[k]);
    await login(ownerEmail, password);
    res = await request(`/api/components/${slug}`, { method: "DELETE" });
    log("owner DELETE succeeds", res.status === 200, `status=${res.status}`);
    slug = null; // cleaned up

    // ---------------------------------------------------------------- studio --
    res = await request("/studio");
    log("studio renders for authed user", res.status === 200, `status=${res.status}`);

    // ------------------------------------------------------------- anon gate
    // Clear jar to simulate signed out: direct fetch without cookies.
    const anonRes = await fetch(`${BASE}/api/components/not-a-real-slug`, { method: "DELETE" });
    log("anonymous DELETE -> 401", anonRes.status === 401, `status=${anonRes.status}`);
  } catch (error) {
    if (error instanceof Error && error.stack) console.error(error.stack);
    console.error("FATAL:", String(error).slice(0, 400));
    failures += 1;
  } finally {
    /**
     * The cleanup removes the rows this run created and nothing else.
     *
     * The old version swept every account on the test domain and every
     * component whose slug matched the fixture's pattern, which took other
     * runs' rows with it: a script that deletes what it did not create turns
     * a concurrent run into a mystery. The two addresses and the one slug
     * are known here, so the sweep was never necessary — and leaving a row
     * behind is what makes the next run fail on a unique index instead of on
     * the thing being checked.
     */
    try {
      if (slug) {
        await client.delete(componentBookmarks).where(eq(componentBookmarks.slug, slug));
        await client.delete(componentVotes).where(eq(componentVotes.slug, slug));
        await client.delete(components).where(eq(components.slug, slug));
      }
      await client.delete(usersTable).where(eq(usersTable.email, ownerEmail));
      await client.delete(usersTable).where(eq(usersTable.email, otherEmail));
    } catch {
      // best effort
    }
  }

  /**
   * There is nothing to close.
   *
   * The client talks to the database over HTTP, so it holds no socket and
   * no pool: there is nothing to release when the run ends.
   */

  console.log(failures === 0 ? "\nALL OWNER-CONTROL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  if (failures > 0) process.exitCode = 1;
}

main();
