import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

import { connectToDatabase } from "../lib/mongodb";
import { planUsername } from "../lib/db/users";
import { recordAccrual } from "../lib/db/payouts";

/**
 * The payout rail, end to end.
 *
 * The ledger has unit tests; what they cannot show is whether the route a
 * creator actually calls is wired to it, whether the identity it uses is the
 * session's, and whether an address change and an address *approval* are
 * really two different things.
 *
 * This walks the whole path against a running server:
 *
 *   - a fresh creator earns nothing and sees nothing;
 *   - an invalid address is refused, a valid one is stored as pending;
 *   - the admin list shows it, and approving a *different* address is a 409 —
 *     the review cannot be tricked into verifying a value nobody saw;
 *   - approval flips it to verified, and re-saving the same address keeps it;
 *   - a new address goes back through review;
 *   - an accrual shows up in the creator's balance, at the 70% share, and
 *     clears the payout minimum.
 *
 * Run with a dev server up:
 *   npx tsx scripts/qa-payouts.ts
 */

const BASE = process.env.BASE ?? "http://localhost:3000";
const PASSWORD = "qa-payout-1234";

type CookieJar = Record<string, string>;
const jar: CookieJar = {};

function cookieHeader() {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function collectCookies(res: Response) {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw: string[] = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const cookie of raw) {
    const first = cookie.split(";")[0];
    const idx = first.indexOf("=");
    if (idx <= 0) continue;
    jar[first.slice(0, idx).trim()] = first.slice(idx + 1).trim();
  }
}

async function request(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (Object.keys(jar).length) headers.set("cookie", cookieHeader());
  const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: "manual" });
  collectCookies(res);
  return res;
}

async function login(email: string, password: string) {
  const csrf = await (await request("/api/auth/csrf")).json();
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

async function logout() {
  const csrf = await (await request("/api/auth/csrf")).json().catch(() => ({}));
  if (csrf?.csrfToken) {
    const params = new URLSearchParams();
    params.set("csrfToken", csrf.csrfToken);
    params.set("callbackUrl", `${BASE}/`);
    params.set("json", "true");
    await request("/api/auth/signout", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  }
  for (const key of Object.keys(jar)) delete jar[key];
}

let failures = 0;
function log(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  ${extra}` : ""}`);
  if (!ok) failures += 1;
}

const address = () => `0x${randomBytes(20).toString("hex")}`;

async function sessionUser() {
  const body = await (await request("/api/auth/session")).json().catch(() => ({}));
  return body?.user?.id ? body.user : null;
}

async function main() {
  const { db } = await connectToDatabase();
  const suffix = randomBytes(4).toString("hex");
  const creatorEmail = `qa-payout-${suffix}@shadway.test`;
  const adminEmail = `qa-payout-admin-${suffix}@shadway.test`;
  const creatorHandle = await planUsername(creatorEmail, "QA Payout");
  const now = new Date();

  const users = db.collection("users");
  const accounts = db.collection("payout_accounts");
  const accruals = db.collection("payout_accruals");

  let creatorId = "";

  try {
    await users.insertOne({
      email: creatorEmail,
      password: await bcrypt.hash(PASSWORD, 12),
      name: "QA Payout",
      username: creatorHandle,
      role: "user",
      createdAt: now,
      updatedAt: now,
    });
    await users.insertOne({
      email: adminEmail,
      password: await bcrypt.hash(PASSWORD, 12),
      name: "QA Payout Admin",
      username: await planUsername(adminEmail, "QA Payout Admin"),
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });

    // --- the creator -------------------------------------------------------
    await login(creatorEmail, PASSWORD);
    const creator = await sessionUser();
    creatorId = creator?.id ?? "";
    log("creator signs in", Boolean(creatorId));

    const empty = await (await request("/api/payouts")).json().catch(() => ({}));
    log(
      "a new creator has no balance",
      empty?.balance?.pendingMinor === "0" && empty?.balance?.address === null,
      `pending=${empty?.balance?.pendingMinor}`
    );

    const bad = await request("/api/payouts/address", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: "0x1234" }),
    });
    log("a malformed address is refused", bad.status === 400, `status=${bad.status}`);

    const wallet = address();
    const saved = await request("/api/payouts/address", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: wallet }),
    });
    const savedBody = await saved.json().catch(() => ({}));
    log(
      "a valid address is stored as pending",
      saved.status === 200 && savedBody?.item?.status === "pending",
      `status=${saved.status} state=${savedBody?.item?.status}`
    );

    const afterSave = await (await request("/api/payouts")).json().catch(() => ({}));
    log(
      "the creator sees their address",
      afterSave?.balance?.address?.toLowerCase() === wallet.toLowerCase() &&
        afterSave?.balance?.addressStatus === "pending"
    );

    // Approval needs a human: the address is not payable on the creator's say.
    const cannotApprove = await request("/api/admin/payout-accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId, address: wallet, action: "verify" }),
    });
    log("a creator cannot approve their own address", cannotApprove.status === 401);

    // --- the admin ---------------------------------------------------------
    await logout();
    await login(adminEmail, PASSWORD);
    log("admin signs in", Boolean(await sessionUser()));

    const list = await (await request("/api/admin/payout-accounts")).json().catch(() => ({}));
    const row = (list?.items ?? []).find((item: { creatorId: string }) => item.creatorId === creatorId);
    log(
      "the pending address is in the review list",
      row?.status === "pending" && row?.address?.toLowerCase() === wallet.toLowerCase()
    );

    const mismatch = await request("/api/admin/payout-accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // A different address than the one on file — exactly what a stale page,
      // or a malicious body, would send.
      body: JSON.stringify({ creatorId, address: address(), action: "verify" }),
    });
    log("approving an address nobody reviewed is a conflict", mismatch.status === 409, `status=${mismatch.status}`);

    const approved = await request("/api/admin/payout-accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId, address: wallet, action: "verify" }),
    });
    const approvedBody = await approved.json().catch(() => ({}));
    log(
      "the reviewed address can be verified",
      approved.status === 200 && approvedBody?.item?.status === "verified",
      `status=${approved.status}`
    );

    // --- back to the creator ----------------------------------------------
    await logout();
    await login(creatorEmail, PASSWORD);

    const verified = await (await request("/api/payouts")).json().catch(() => ({}));
    log("the creator sees the address verified", verified?.balance?.addressStatus === "verified");

    // Re-saving a verified address must not silently send it back to review.
    const again = await request("/api/payouts/address", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: wallet }),
    });
    const againBody = await again.json().catch(() => ({}));
    log(
      "saving the same address keeps its verification",
      again.status === 200 && againBody?.item?.status === "verified"
    );

    const moved = address();
    const changed = await request("/api/payouts/address", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: moved }),
    });
    const changedBody = await changed.json().catch(() => ({}));
    log(
      "a changed address goes back through review",
      changed.status === 200 && changedBody?.item?.status === "pending"
    );

    // --- an accrual --------------------------------------------------------
    const gross = BigInt(10_000_000); // 10.000000 USDC
    const accrual = await recordAccrual({
      creatorId,
      username: creatorHandle,
      amountMinor: gross.toString(),
      reason: "install",
      source: "admin",
      sourceId: `qa-payout-${suffix}`,
      recordedBy: "qa-payouts",
    });
    log("an accrual is recorded", accrual.created);

    const earned = await (await request("/api/payouts")).json().catch(() => ({}));
    log(
      "the balance carries the accrual exactly",
      earned?.balance?.pendingMinor === gross.toString(),
      `pending=${earned?.balance?.pendingMinor}`
    );
    // 70% of 10.000000 USDC.
    log(
      "the creator's share is 70% of gross",
      earned?.balance?.estimatedOwedMinor === "7000000",
      `estimated=${earned?.balance?.estimatedOwedMinor}`
    );
    log("the balance clears the payout minimum", earned?.balance?.readyToPay === true);
    log(
      "the accrual appears in the creator's history",
      (earned?.accruals ?? []).some(
        (item: { sourceId?: string; amountMinor?: string }) =>
          item.sourceId === `qa-payout-${suffix}` && item.amountMinor === gross.toString()
      )
    );
  } finally {
    await accounts.deleteMany({ creatorId }).catch(() => {});
    await accruals.deleteMany({ creatorId }).catch(() => {});
    await users.deleteMany({ email: { $in: [creatorEmail, adminEmail] } }).catch(() => {});
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
