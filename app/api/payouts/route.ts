import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import {
  PayoutLedgerUnavailableError,
  accrualToJson,
  balanceToJson,
  batchToJson,
  getCreatorBalance,
  listCreatorAccruals,
  listCreatorBatches,
} from "@/lib/db/payouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A creator's own earnings.
 *
 * The id comes from the session and from nowhere else. `getCreatorBalance`,
 * `listCreatorBatches` and `listCreatorAccruals` all take a `creatorId` that
 * the caller would otherwise be free to choose, so the one line that matters
 * here is that no part of the request body or query string is ever read. A
 * route that accepted `?creatorId=` would be a way to read what everybody
 * earns, one guess at a time.
 *
 * The ledger is allowed to be unavailable without taking the account pages
 * down — a signed-in creator still gets a 503 with a sentence instead of a
 * blank settings page.
 */
export async function GET() {
  const { session, response } = await requireSession();
  if (response) return response;

  const creatorId = session.user?.id;
  if (!creatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [balance, batches, accruals] = await Promise.all([
      getCreatorBalance(creatorId),
      listCreatorBatches(creatorId, 12),
      listCreatorAccruals(creatorId, 12),
    ]);

    return NextResponse.json(
      {
        balance: balanceToJson(balance),
        batches: batches.map(batchToJson),
        accruals: accruals.map(accrualToJson),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof PayoutLedgerUnavailableError) {
      console.error("Payout ledger unavailable:", error.message);
      return NextResponse.json(
        { error: "The payout ledger is temporarily unavailable. Nothing was lost — try again shortly." },
        { status: 503 }
      );
    }

    console.error("Failed to load payouts:", error);
    return NextResponse.json({ error: "Failed to load payouts" }, { status: 500 });
  }
}
