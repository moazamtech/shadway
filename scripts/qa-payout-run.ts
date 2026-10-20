import "dotenv/config";
import { and, count, eq, type SQL } from "drizzle-orm";

import { db } from "../lib/db/postgres";
import { payoutAccounts, payoutAccruals, payoutBatches } from "../lib/db/schema";
import { recordAccrual } from "../lib/db/payouts";
import { BASE, createQaAccount, removeQaAccount, type QaAccount } from "./qa-session";

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

/**
 * How many batches the ledger holds.
 *
 * The check asks the table the same question the collection was asked, and
 * the answer is the same number for the same reason: a batch that was never
 * written is a row that is not there.
 */
async function countBatches(where?: SQL): Promise<number> {
  const query = db().select({ n: count() }).from(payoutBatches);
  const rows = where ? await query.where(where) : await query;
  return rows[0]?.n ?? 0;
}

async function main() {
  const suffix = Math.random().toString(36).slice(2, 8);

  let creatorId = "";
  let periodStart = "";
  let periodEnd = "";

  /**
   * The two accounts the run is walked with.
   *
   * The ledger is keyed by the id the session carries, so both accounts have
   * to live in the table the application reads: an account the application
   * cannot find is an account with no ledger, and the batch below would be
   * planned for a creator who does not exist.
   *
   * They are made inside the block that cleans up after them, because an
   * account made and then abandoned is an account that stays.
   */
  let creator: QaAccount | null = null;
  let admin: QaAccount | null = null;

  try {
    creator = await createQaAccount("user");
    admin = await createQaAccount("admin");

    await login(creator.email, creator.password);
    const session = await (await request("/api/auth/session")).json();
    creatorId = session?.user?.id ?? "";
    log("a creator signs in", Boolean(creatorId));

    // A verified address, so the batch has somewhere to send the money.
    const wallet = `0x${"ab".repeat(20)}`;
    const requestedAt = new Date();
    await db()
      .insert(payoutAccounts)
      .values({
        creatorId,
        address: wallet,
        chain: "base",
        status: "verified",
        requestedAt,
        verifiedAt: requestedAt,
        createdAt: requestedAt,
        updatedAt: requestedAt,
      });

    // A week of earnings: 12 USDC, which clears the 5 USDC minimum.
    const now = new Date();
    periodEnd = now.toISOString();
    periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const accrual = await recordAccrual({
      creatorId,
      username: session?.user?.username,
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

    await login(admin.email, admin.password);
    const adminSession = await (await request("/api/auth/session")).json();
    log("an admin signs in", adminSession?.user?.role === "admin");

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

    const batchesBefore = await countBatches();
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

    const written = (
      await db()
        .select()
        .from(payoutBatches)
        .where(eq(payoutBatches.runId, runBody.runId ?? ""))
        .limit(1)
        .catch(() => [])
    )[0];
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

    const claimed = (
      await db()
        .select()
        .from(payoutAccruals)
        .where(
          and(
            eq(payoutAccruals.creatorId, creatorId),
            eq(payoutAccruals.sourceId, `qa-run-${suffix}`),
          ),
        )
        .limit(1)
    )[0];
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

    const total = await countBatches(eq(payoutBatches.runId, runBody.runId ?? ""));
    log("there is exactly one batch for the week", total === 1, `batches=${total}`);
  } finally {
    /**
     * The week is unwritten.
     *
     * The batch, the accrual it claimed and the address it would have paid
     * are all addressed by the creator they belong to, so the cleanup takes
     * exactly this run's rows and leaves the ledger as it found it — a batch
     * left behind would make the next run's "one batch for the week" a lie.
     */
    await db().delete(payoutBatches).where(eq(payoutBatches.creatorId, creatorId)).catch(() => {});
    await db().delete(payoutAccruals).where(eq(payoutAccruals.creatorId, creatorId)).catch(() => {});
    await db().delete(payoutAccounts).where(eq(payoutAccounts.creatorId, creatorId)).catch(() => {});
    if (creator) await removeQaAccount(creator.email).catch(() => {});
    if (admin) await removeQaAccount(admin.email).catch(() => {});
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
