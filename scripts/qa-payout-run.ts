import "dotenv/config";
import bcrypt from "bcryptjs";

import { connectToDatabase } from "../lib/mongodb";
import { planUsername } from "../lib/db/users";
import { recordAccrual } from "../lib/db/payouts";

/**
 * The weekly run, end to end.
 *
 * The ledger, the balances and the address review all have their own
 * checks. This one walks the step that turns an accrual into a payment: a
 * week of earnings, a verified address, an admin asking what would be paid,
 * an admin saying yes, and the ledger recording that decision.
 *
 * It also proves the two things that make a weekly run safe to repeat — the
 * same window twice writes one batch, and an accrual is paid once.
 *
 * It stops where the design stops: the batch is written and claimed, and it
 * is not signed. The signing key is not in this application, and a test that
 * could move money would be a test with a key in it.
 *
 * Run with a dev server up:
 *   npx tsx scripts/qa-payout-run.ts
 */

const BASE = process.env.BASE ?? "http://localhost:3000";
const PASSWORD = "qa-run-1234";

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

async function login(email: string, password: string) {
  const csrf = await (await request("/api/auth/csrf")).json();
  const params = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email,
    password,
    callbackUrl: `${BASE}/`,
    json: "true",
  });
  await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
}

async function main() {
  const { db } = await connectToDatabase();
  const suffix = Math.random().toString(36).slice(2, 8);
  const creatorEmail = `qa-run-${suffix}@shadway.test`;
  const adminEmail = `qa-run-admin-${suffix}@shadway.test`;
  const users = db.collection("users");
  const accounts = db.collection("payout_accounts");
  const accruals = db.collection("payout_accruals");
  const batches = db.collection("payout_batches");

  let creatorId = "";
  let periodStart = "";
  let periodEnd = "";

  try {
    await users.insertOne({
      email: creatorEmail,
      password: await bcrypt.hash(PASSWORD, 12),
      name: "QA Run",
      username: await planUsername(creatorEmail, "QA Run"),
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await users.insertOne({
      email: adminEmail,
      password: await bcrypt.hash(PASSWORD, 12),
      name: "QA Run Admin",
      username: await planUsername(adminEmail, "QA Run Admin"),
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await login(creatorEmail, PASSWORD);
    const creator = await (await request("/api/auth/session")).json();
    creatorId = creator?.user?.id ?? "";
    log("a creator signs in", Boolean(creatorId));

    // A verified address, so the batch has somewhere to send the money.
    const wallet = `0x${"ab".repeat(20)}`;
    await accounts.insertOne({
      creatorId,
      address: wallet,
      chain: "base",
      status: "verified",
      requestedAt: new Date(),
      verifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // A week of earnings: 12 USDC, which clears the 5 USDC minimum.
    const now = new Date();
    periodEnd = now.toISOString();
    periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const accrual = await recordAccrual({
      creatorId,
      username: creator?.user?.username,
      amountMinor: "12000000",
      reason: "install",
      source: "admin",
      sourceId: `qa-run-${suffix}`,
      occurredAt: new Date(now.getTime() - 60 * 60 * 1000),
      recordedBy: "qa-payout-run",
    });
    log("the week's earnings are recorded", accrual.created);

    // 1. A creator cannot run the batch — checked while the creator is still
    // the one signed in.
    const forbidden = await request("/api/admin/payouts/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true, periodStart, periodEnd }),
    });
    log("a creator cannot run the batch", forbidden.status === 401, `status=${forbidden.status}`);

    await login(adminEmail, PASSWORD);
    const admin = await (await request("/api/auth/session")).json();
    log("an admin signs in", admin?.user?.role === "admin");

    // 2. The preview says what would be paid, and writes nothing.
    const preview = await request(
      `/api/admin/payouts/run?periodStart=${encodeURIComponent(periodStart)}&periodEnd=${encodeURIComponent(periodEnd)}`,
    );
    const previewBody = (await preview.json().catch(() => ({}))) as {
      plan?: { lines?: { owedMinor?: string; address?: string }[]; totals?: { owedMinor?: string } };
      runId?: string;
    };
    log(
      "the preview names the creator and the amount",
      preview.status === 200 &&
        previewBody.plan?.lines?.length === 1 &&
        previewBody.plan.lines[0].owedMinor === "8400000" &&
        previewBody.plan.lines[0].address === wallet,
      `owed=${previewBody.plan?.lines?.[0]?.owedMinor ?? "none"}`,
    );
    log(
      "70% of 12 USDC is what is owed",
      previewBody.plan?.totals?.owedMinor === "8400000",
      `totals=${previewBody.plan?.totals?.owedMinor ?? "none"}`,
    );

    const batchesBefore = await batches.countDocuments({});
    log("the preview wrote no batch", batchesBefore === 0, `batches=${batchesBefore}`);

    // 3. The run itself.
    const run = await request("/api/admin/payouts/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true, periodStart, periodEnd }),
    });
    const runBody = (await run.json().catch(() => ({}))) as {
      batches?: number;
      runId?: string;
      unclaimed?: string[];
    };
    log(
      "the run writes one batch",
      run.status === 200 && runBody.batches === 1,
      `batches=${runBody.batches}`,
    );
    log("nothing was left unclaimed", (runBody.unclaimed ?? []).length === 0);

    const written = await batches.findOne({ runId: runBody.runId }).catch(() => null);
    log(
      "the batch is recorded and waiting for a signature",
      written?.status === "planned" && written?.chain === "base",
      `status=${written?.status ?? "none"}`,
    );
    log(
      "the batch names where the money goes",
      written?.toAddress === wallet,
      `to=${written?.toAddress ?? "none"}`,
    );

    const claimed = await accruals.findOne({ creatorId, sourceId: `qa-run-${suffix}` });
    log("the earnings are claimed by the batch", Boolean(claimed?.batchId));

    // 4. The same week again changes nothing.
    const again = await request("/api/admin/payouts/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true, periodStart, periodEnd }),
    });
    const againBody = (await again.json().catch(() => ({}))) as { batches?: number };
    log(
      "running the same week again writes no second batch",
      again.status === 200 && againBody.batches === 0,
      `batches=${againBody.batches}`,
    );

    const total = await batches.countDocuments({ runId: runBody.runId });
    log("there is exactly one batch for the week", total === 1, `batches=${total}`);
  } finally {
    await batches.deleteMany({ creatorId }).catch(() => {});
    await accruals.deleteMany({ creatorId }).catch(() => {});
    await accounts.deleteMany({ creatorId }).catch(() => {});
    await users.deleteMany({ email: { $in: [creatorEmail, adminEmail] } }).catch(() => {});
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
