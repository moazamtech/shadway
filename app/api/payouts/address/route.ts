import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import {
  PayoutLedgerUnavailableError,
  getPayoutAccount,
  isEvmAddress,
  putPayoutAccount,
} from "@/lib/db/payouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ADDRESS_LENGTH = 42;

/**
 * Where a creator's USDC is sent.
 *
 * Three rules, each of which is the difference between a payout rail and an
 * account-takeover rail:
 *
 * 1. The address is shape-checked, then stored as `pending`. A creator is
 *    *requesting* a destination; a human verifies it before the weekly batch
 *    pays anything. A stolen session must not be able to redirect money in one
 *    request.
 * 2. An unchanged address keeps its existing status. Re-saving a verified
 *    address must not silently un-verify it — and, more importantly, must not
 *    make an attacker's "save" of the same value look like a fresh request.
 * 3. The only identity written is the session's. There is no body field that
 *    names a creator.
 */
export async function PUT(request: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const creatorId = session.user?.id;
  if (!creatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const raw = typeof payload.address === "string" ? payload.address.trim() : "";

  if (!raw) {
    return NextResponse.json({ error: "Enter the wallet address you want to be paid at." }, { status: 400 });
  }
  if (raw.length > MAX_ADDRESS_LENGTH || !isEvmAddress(raw)) {
    return NextResponse.json(
      { error: "A payout address is a 0x-prefixed, 40-character Base address (0x followed by 40 hex digits)." },
      { status: 400 }
    );
  }

  try {
    const current = await getPayoutAccount(creatorId);

    // Same address: keep the verification somebody already gave it.
    if (current && current.address.toLowerCase() === raw.toLowerCase() && current.status === "verified") {
      return NextResponse.json({
        item: {
          address: current.address,
          status: current.status,
          chain: current.chain,
          updatedAt: current.updatedAt?.toISOString() ?? null,
        },
      });
    }

    const account = await putPayoutAccount({
      creatorId,
      address: raw,
      status: "pending",
      actorId: creatorId,
    });

    return NextResponse.json({
      item: {
        address: account.address,
        status: account.status,
        chain: account.chain,
        updatedAt: account.updatedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    if (error instanceof PayoutLedgerUnavailableError) {
      console.error("Payout account unavailable:", error.message);
      return NextResponse.json(
        { error: "The payout ledger is temporarily unavailable. Try again shortly." },
        { status: 503 }
      );
    }

    console.error("Failed to save payout address:", error);
    return NextResponse.json({ error: "Failed to save the payout address" }, { status: 500 });
  }
}
