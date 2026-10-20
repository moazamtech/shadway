import "dotenv/config";
import bcrypt from "bcryptjs";
import type { Page } from "puppeteer";

import {
  createAccount,
  deleteAccount,
  findAccountByEmail,
  planUsername,
} from "../lib/db/users";
import { db } from "../lib/db/postgres";
import { components as componentsTable } from "../lib/db/schema";
import { sql } from "drizzle-orm";

/**
 * A signed-in browser for the checks that need one.
 *
 * The studio, the settings page and the admin panel are all behind a login,
 * and the checks that walk them used to open them as a stranger — which
 * answered with a redirect to the sign-in page and a set of assertions about
 * a page that was never there.
 *
 * So: an account is created, a session is minted through the same credentials
 * route the site uses, and the cookie is handed to the browser. The account
 * is removed afterwards, and the component it published with it.
 */

export const BASE = process.env.BASE ?? "http://localhost:3000";
export const PASSWORD = "qa-session-1234";

export type QaAccount = {
  email: string;
  password: string;
  username: string;
  userId: string;
};

export async function createQaAccount(role: "user" | "admin" = "admin"): Promise<QaAccount> {
  const suffix = Math.random().toString(36).slice(2, 8);
  const email = `qa-session-${suffix}@shadway.test`;
  const username = await planUsername(email, "QA Session");

  const account = await createAccount({
    email,
    password: await bcrypt.hash(PASSWORD, 12),
    name: "QA Session",
    username,
    role,
  });

  return {
    email,
    password: PASSWORD,
    username,
    userId: account._id ?? "",
  };
}

export async function removeQaAccount(email: string): Promise<void> {
  const account = await findAccountByEmail(email);
  if (!account?._id) return;

  // The components an account published are removed with it: the author is
  // a record on the component, so the two are cleaned up together.
  await db()
    .delete(componentsTable)
    .where(
      sql`${componentsTable.author}->>'userId' = ${account._id}`,
    );
  await deleteAccount(account._id);
}

/**
 * Sign in through the site's own credentials route and hand the cookie to
 * the browser.
 *
 * The cookie is minted by the route rather than set by hand, so the browser
 * carries exactly the session the server would have given it — including the
 * parts of it that are signed.
 */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  const jar: Record<string, string> = {};

  const request = async (path: string, init?: RequestInit) => {
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
  };

  const csrf = await (await request("/api/auth/csrf")).json();
  await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email,
      password,
      callbackUrl: `${BASE}/`,
      json: "true",
    }).toString(),
  });

  const session = await (await request("/api/auth/session")).json();
  if (!session?.user?.id) {
    throw new Error("the QA session could not be signed in");
  }

  await page.setCookie(
    ...Object.entries(jar).map(([name, value]) => ({
      name,
      value,
      domain: "localhost",
      path: "/",
    })),
  );
}

/** The text of every frame on the page, joined. */
export async function frameText(page: Page): Promise<string> {
  const texts = await Promise.all(
    page
      .frames()
      .filter((frame) => frame !== page.mainFrame())
      .map((frame) =>
        frame.evaluate(() => document.body?.innerText?.trim() || "").catch(() => ""),
      ),
  );
  return texts.join(" | ");
}
