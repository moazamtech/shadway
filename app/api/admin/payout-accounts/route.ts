import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  PayoutLedgerUnavailableError,
  getAccountCollection,
  getPayoutAccount,
  isEvmAddress,
  putPayoutAccount,
} from "@/lib/db/payouts";
import { usernamesFor as usernamesForAccounts } from "@/lib/db/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Address verification — the human step between "a creator asked to be paid
 * here" and "the weekly batch may send money here".
 *
 * A stolen session can call `PUT /api/payouts/address` and change the
 * destination. It cannot approve it. That is the whole reason this route is
 * separate, admin-only, and refuses to act unless the address it is being
 * asked to verify is byte-for-byte the one on file: an admin who reviews
 * `0xabc…` and then saves a body naming `0xdef…` must not be able to approve
 * an address nobody looked at.
 */

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "admin") return null;
  return session;
}

async function usernamesFor(creatorIds: string[]): Promise<Map<string, string>> {
  return usernamesForAccounts(creatorIds);
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accounts = await getAccountCollection();
    const rows = await accounts.find({}).sort({ status: 1, updatedAt: -1 }).limit(200).toArray();
    const names = await usernamesFor(rows.map((row) => row.creatorId));

    return NextResponse.json(
      {
        items: rows.map((row) => ({
          creatorId: row.creatorId,
          creator: names.get(row.creatorId) ?? null,
          address: row.address,
          chain: row.chain,
          status: row.status,
          requestedAt: row.requestedAt?.toISOString() ?? null,
          verifiedAt: row.verifiedAt?.toISOString() ?? null,
          verifiedBy: row.verifiedBy ?? null,
          updatedAt: row.updatedAt?.toISOString() ?? null,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof PayoutLedgerUnavailableError) {
      return NextResponse.json({ error: "The payout ledger is unavailable." }, { status: 503 });
    }
    console.error("Failed to list payout accounts:", error);
    return NextResponse.json({ error: "Failed to list payout accounts" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const creatorId = typeof payload.creatorId === "string" ? payload.creatorId.trim() : "";
  const address = typeof payload.address === "string" ? payload.address.trim() : "";
  const action = payload.action === "verify" ? "verified" : payload.action === "reject" ? "rejected" : null;

  if (!creatorId || !action) {
    return NextResponse.json(
      { error: "creatorId and an action of verify or reject are required." },
      { status: 400 }
    );
  }
  if (!isEvmAddress(address)) {
    return NextResponse.json({ error: "A valid address is required." }, { status: 400 });
  }

  try {
    const current = await getPayoutAccount(creatorId);
    if (!current) {
      return NextResponse.json({ error: "That creator has not requested an address." }, { status: 404 });
    }
    if (current.address.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json(
        { error: "The address changed since you reviewed it. Reload and review the new one." },
        { status: 409 }
      );
    }

    const account = await putPayoutAccount({
      creatorId,
      address: current.address,
      status: action,
      actorId: session.user.id,
    });

    return NextResponse.json({
      item: {
        creatorId: account.creatorId,
        address: account.address,
        status: account.status,
        verifiedAt: account.verifiedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    if (error instanceof PayoutLedgerUnavailableError) {
      return NextResponse.json({ error: "The payout ledger is unavailable." }, { status: 503 });
    }
    console.error("Failed to review payout account:", error);
    return NextResponse.json({ error: "Failed to review the payout address" }, { status: 500 });
  }
}
