import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  PayoutLedgerUnavailableError,
  listPayoutTargets,
  listUnpaidAccruals,
  writeBatch,
} from "@/lib/db/payouts";
import { toAmountString } from "@/lib/payouts/amount";
import { planPayout, type AccrualRow } from "@/lib/payouts/payouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The weekly run.
 *
 * This is the step that turns accruals into a payment, and it stops one
 * step short of moving the money on purpose: the batch is planned, written
 * and claimed, and it is then handed to whoever holds the signing key. The
 * key is not in this application — it is not in the request body, not in the
 * database, and not in the environment this route can read — so the route
 * cannot sign, and the only thing it can be asked to do is decide *what*
 * would be paid and to record that decision.
 *
 * Two things make the run safe to repeat. The window is derived from the
 * request, not from the clock, and the run id is derived from the window, so
 * running the same week twice writes the same batch rather than a second
 * one. And `writeBatch` claims the accruals it covers, so an event cannot be
 * paid twice even if the window is moved.
 *
 * A preview (`GET`, or a `POST` without `confirm`) writes nothing. It is the
 * same arithmetic the write uses, so what an operator reads is what the
 * ledger will record.
 */

const DEFAULT_WINDOW_DAYS = 7;

function adminSession() {
  return getServerSession(authOptions);
}

function windowFor(body: { periodStart?: unknown; periodEnd?: unknown }) {
  const end = typeof body.periodEnd === "string" ? new Date(body.periodEnd) : new Date();
  const start =
    typeof body.periodStart === "string"
      ? new Date(body.periodStart)
      : new Date(end.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  if (start >= end) return null;
  return { periodStart: start, periodEnd: end };
}

/**
 * The run id names the window, so the same week is the same run.
 *
 * A timestamp would make every attempt a new run, and a run that is written
 * twice is a run that can pay twice.
 */
function runIdFor(periodStart: Date, periodEnd: Date): string {
  return `weekly-${periodStart.toISOString().slice(0, 10)}-${periodEnd.toISOString().slice(0, 10)}`;
}

async function plan(
  periodStart: Date,
  periodEnd: Date,
): Promise<{
  runId: string;
  plan: ReturnType<typeof planPayout>;
  rows: AccrualRow[];
}> {
  const accruals = await listUnpaidAccruals({ periodStart, periodEnd });
  const rows: AccrualRow[] = accruals.map((row) => ({
    id: row.id,
    creatorId: row.creatorId,
    amountMinor: row.amountMinor,
    occurredAt: row.occurredAt,
  }));
  const creatorIds = [...new Set(rows.map((row) => row.creatorId))];
  const targets = await listPayoutTargets(creatorIds);

  return {
    runId: runIdFor(periodStart, periodEnd),
    plan: planPayout(rows, { targets }),
    rows,
  };
}

function planJson(plan: ReturnType<typeof planPayout>) {
  return {
    lines: plan.lines.map((line) => ({
      creatorId: line.creatorId,
      address: line.address,
      grossMinor: toAmountString(line.grossMinor),
      owedMinor: toAmountString(line.owedMinor),
      eventCount: line.eventCount,
    })),
    skipped: plan.skipped.map((line) => ({
      creatorId: line.creatorId,
      reason: line.reason,
      grossMinor: toAmountString(line.grossMinor),
      owedMinor: toAmountString(line.owedMinor),
      shortfallMinor: toAmountString(line.shortfallMinor),
      eventCount: line.eventCount,
    })),
    totals: {
      grossMinor: toAmountString(plan.totals.grossMinor),
      owedMinor: toAmountString(plan.totals.owedMinor),
      platformRemainder: plan.totals.platformRemainder.toString(),
      creatorsPaid: plan.totals.creatorsPaid,
      creatorsSkipped: plan.totals.creatorsSkipped,
    },
  };
}

export async function GET(request: Request) {
  const session = await adminSession();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const window = windowFor({
    periodStart: url.searchParams.get("periodStart") ?? undefined,
    periodEnd: url.searchParams.get("periodEnd") ?? undefined,
  });
  if (!window) {
    return NextResponse.json({ error: "The period is not a range of time." }, { status: 400 });
  }

  try {
    const { runId, plan: payoutPlan } = await plan(window.periodStart, window.periodEnd);
    return NextResponse.json({
      ok: true,
      runId,
      window: {
        periodStart: window.periodStart.toISOString(),
        periodEnd: window.periodEnd.toISOString(),
      },
      plan: planJson(payoutPlan),
    });
  } catch (error) {
    if (error instanceof PayoutLedgerUnavailableError) {
      console.error("Payout run unavailable:", error.message);
      return NextResponse.json(
        { error: "The payout ledger is temporarily unavailable." },
        { status: 503 },
      );
    }
    console.error("Failed to plan the payout run:", error);
    return NextResponse.json({ error: "Failed to plan the payout run" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await adminSession();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { periodStart?: unknown; periodEnd?: unknown; confirm?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const window = windowFor(body);
  if (!window) {
    return NextResponse.json({ error: "The period is not a range of time." }, { status: 400 });
  }

  try {
    const { runId, plan: payoutPlan, rows } = await plan(window.periodStart, window.periodEnd);

    if (body.confirm !== true) {
      return NextResponse.json({
        ok: true,
        written: false,
        runId,
        window: {
          periodStart: window.periodStart.toISOString(),
          periodEnd: window.periodEnd.toISOString(),
        },
        plan: planJson(payoutPlan),
      });
    }

    /**
     * Nothing to pay is not a failure. A week with no earnings writes no
     * batch, and saying so is more useful than an error.
     */
    if (!payoutPlan.lines.length) {
      return NextResponse.json({
        ok: true,
        written: true,
        runId,
        batches: 0,
        duplicates: 0,
        unclaimed: [],
        plan: planJson(payoutPlan),
      });
    }

    const result = await writeBatch({
      runId,
      periodStart: window.periodStart,
      periodEnd: window.periodEnd,
      createdBy: session.user.id,
      lines: payoutPlan.lines.map((line) => ({
        creatorId: line.creatorId,
        address: line.address,
        grossMinor: line.grossMinor,
        owedMinor: line.owedMinor,
        roundingRemainder: line.roundingRemainder,
        eventIds: line.eventIds,
      })),
    });

    return NextResponse.json({
      ok: true,
      written: true,
      runId,
      batches: result.created,
      duplicates: result.duplicates,
      unclaimed: result.unclaimed,
      events: rows.length,
      plan: planJson(payoutPlan),
    });
  } catch (error) {
    if (error instanceof PayoutLedgerUnavailableError) {
      console.error("Payout run unavailable:", error.message);
      return NextResponse.json(
        { error: "The payout ledger is temporarily unavailable." },
        { status: 503 },
      );
    }
    console.error("Failed to write the payout batch:", error);
    return NextResponse.json({ error: "Failed to write the payout batch" }, { status: 500 });
  }
}
