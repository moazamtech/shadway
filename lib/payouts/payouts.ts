import {
  applyBps,
  assertAmount,
  toAmountString,
  type Amount,
  BPS_SCALE,
} from "@/lib/payouts/amount";

/**
 * The batch calculation: who is owed what for a period.
 *
 * Everything here is a pure function over rows that were already read out of
 * MongoDB. No connection, no clock, no randomness — which is what makes the
 * rounding rule testable, and the rounding rule is the part most likely to be
 * quietly wrong.
 *
 * ## The shape of the flow
 *
 * Accrual events record **gross** attributable revenue in USDC minor units.
 * They are never netted at record time. The creator's share is worked out once,
 * here, per creator per payment. That single decision is what keeps rounding
 * loss bounded by the number of *payments* instead of the number of *events* —
 * see below, because it is the whole point.
 *
 * ## Why the share is computed here and not per event
 *
 * The obvious implementation splits each accrual as it is recorded: 0.007 USDC
 * of install revenue at 70% is 0.0049 USDC, which rounds to 0.004 USDC and
 * loses 0.0009 USDC. Do that per event and a component with a million installs
 * has quietly donated roughly a dollar to rounding. Per-event truncation is
 * lossless-looking in isolation and ruinous in aggregate, because the loss is
 * O(events).
 *
 * Doing the split once, over the creator's cumulative gross for the period,
 * makes the loss O(payments): the residue is strictly less than 1/10000 of a
 * minor unit per creator per payment — less than a millionth of a USDC — and it
 * does not grow with traffic. A million installs consolidated into one payment
 * cost the platform the same fraction of a cent as a single install would.
 *
 * ## Where the remainder goes
 *
 * Deliberately: to the platform, accounted for, never to the creator.
 *
 *   `remainder = (gross × bps) − (owed × 10_000)`
 *
 * in units of 1/10000 of a minor unit, always in `[0, 9999]` for a positive
 * gross. It is stored on the batch document as `roundingRemainder` and summed
 * into the run's `platformRemainder`, so the money is accounted for even though
 * it is not a claim anybody can draw. It is never pushed onto a creator: doing
 * so would let rounding artefacts become real recurring payouts, and — worse —
 * make a creator's payout depend on the *number of events that happened to
 * fall in their period*, which is not something they can predict or control.
 *
 * It is also never "recovered" later. A subsequent batch computes over a larger
 * cumulative gross; it does not add the old residue back in, because that
 * residue was never owed in the first place.
 *
 * ## Below the threshold
 *
 * A creator is paid only if they clear `MIN_PAYOUT_MINOR`. Under it, the batch
 * **skips them and claims nothing**: their events stay unpaid, and the next
 * batch re-sums them because they are still unpaid. Carry-forward is therefore
 * the natural behaviour of the data rather than a scheduled job that can be
 * forgotten — a balance cannot expire, drift, or be missed by a bug, because
 * nothing ever has to move it. What is deliberately *not* implemented is a
 * dormancy rule: expiring an old balance discards creator money, and if the
 * business ever wants that, it has to be an explicit, announced policy rather
 * than a `createdAt` filter nobody remembers adding.
 *
 * The skipped creators are returned by name with their balance so the
 * sub-threshold state is visible to an admin instead of being a silence.
 */

/**
 * Creator's share of attributed revenue: 70%.
 *
 * A constant rather than a request field, on purpose. A rate that an admin can
 * type into a batch form is a rate that will eventually be typed wrong, and a
 * wrong rate is retroactive: every accrual in the period gets re-split at it.
 * Changing the rate is a code change with a changelog entry, not a Tuesday
 * afternoon.
 */
export const REVENUE_SHARE_BPS = 7000;

/**
 * The smallest payout worth making: 5 USDC.
 *
 * A Base transfer costs a fraction of a cent in gas, but it also has to be
 * *worth the operational cost* of a human checking a wallet address before
 * money moves. 5 USDC clears both, and it is round enough to explain on a
 * support ticket.
 */
export const MIN_PAYOUT_MINOR: Amount = BigInt(5_000_000);

/** What a creator's payout address is allowed to be right now. */
export type PayoutAddressState = "ready" | "unverified" | "missing" | "invalid";

/** One unpaid accrual, as the batch calculation needs to see it. */
export type AccrualRow = {
  id: string;
  creatorId: string;
  /** Gross attributable revenue in USDC minor units. Never netted. */
  amountMinor: Amount;
  occurredAt: Date;
};

/** What the batch needs to know about where the money would go. */
export type CreatorPayoutTarget = {
  creatorId: string;
  address: string | null | undefined;
  /** Whether the address has been checked by a human. Only `ready` is paid. */
  addressState: PayoutAddressState;
};

/** A creator who is being paid this period. */
export type PayoutLine = {
  creatorId: string;
  address: string;
  currency: "USDC";
  chain: "base";
  /** What accrued to them in the period, before the share. */
  grossMinor: Amount;
  /** What they are actually being paid. Always an integer number of minor units. */
  owedMinor: Amount;
  /**
   * The residue kept by the platform, in 1/10000 of a minor unit. Kept on the
   * batch document so the money is accounted for even though nobody can claim
   * it.
   */
  roundingRemainder: bigint;
  eventCount: number;
  eventIds: string[];
};

/** A creator the batch decided not to pay, and why. */
export type SkippedLine = {
  creatorId: string;
  grossMinor: Amount;
  /** What they would have been paid had the threshold or address allowed it. */
  owedMinor: Amount;
  eventCount: number;
  /** `"below_minimum"` | `"no_address"` | `"address_unverified"` | `"address_invalid"`. */
  reason: string;
  /** How far short of the threshold they are. Zero when the address is the problem. */
  shortfallMinor: Amount;
};

export type PayoutPlan = {
  lines: PayoutLine[];
  skipped: SkippedLine[];
  totals: {
    /** Gross accrued across every creator in the period. */
    grossMinor: Amount;
    /** Actually being paid. The sum of `lines[].owedMinor`. */
    owedMinor: Amount;
    /** Sum of `lines[].roundingRemainder`, in 1/10000 of a minor unit. */
    platformRemainder: bigint;
    creatorsPaid: number;
    creatorsSkipped: number;
  };
};

export type PlanPayoutOptions = {
  /** Share of gross owed to the creator. Defaults to `REVENUE_SHARE_BPS`. */
  bps?: number;
  /** Minimum payment. Defaults to `MIN_PAYOUT_MINOR`. */
  minMinor?: Amount;
  /**
   * Where each creator's money would go. A creator missing from this map has
   * no address on file and is skipped as `"no_address"` — the batch never
   * invents a destination.
   */
  targets?: readonly CreatorPayoutTarget[];
};

/** Address states that a batch is allowed to pay. Deliberately a whitelist. */
const PAYABLE_ADDRESS_STATES: ReadonlySet<PayoutAddressState> = new Set<PayoutAddressState>([
  "ready",
]);

/**
 * Who is owed what for a period.
 *
 * `rows` are accruals that are unpaid and belong to the period; the caller has
 * already applied the date window. Every creator in the input appears in
 * exactly one of `lines` or `skipped` — a creator who quietly vanishes from
 * both is the failure this shape exists to prevent.
 */
export function planPayout(
  rows: readonly AccrualRow[],
  options: PlanPayoutOptions = {},
): PayoutPlan {
  const bps = options.bps ?? REVENUE_SHARE_BPS;
  const minMinor = assertAmount(options.minMinor ?? MIN_PAYOUT_MINOR, "minMinor");
  const targets = new Map((options.targets ?? []).map((target) => [target.creatorId, target]));

  // Aggregate first, split second. Grouping before the division is the entire
  // remainder argument; doing it the other way round reintroduces O(events)
  // rounding loss.
  type Bucket = { gross: Amount; eventIds: string[] };
  const buckets = new Map<string, Bucket>();

  for (const row of rows) {
    const amount = assertAmount(row.amountMinor, `accrual ${row.id}`);
    const existing = buckets.get(row.creatorId);
    if (existing) {
      existing.gross += amount;
      existing.eventIds.push(row.id);
    } else {
      buckets.set(row.creatorId, { gross: amount, eventIds: [row.id] });
    }
  }

  const lines: PayoutLine[] = [];
  const skipped: SkippedLine[] = [];
  let grossTotal = BigInt(0);
  let owedTotal = BigInt(0);
  let platformRemainder = BigInt(0);

  for (const [creatorId, bucket] of buckets) {
    grossTotal += bucket.gross;

    // A negative gross (a clawback period) nets against the positive events of
    // the same creator before the threshold is applied, so a reversal cannot
    // manufacture a payout out of nothing and then strand it below minimum.
    const { amount: owed, remainder } = applyBps(bucket.gross, bps);

    const target = targets.get(creatorId);
    const address = target?.address ?? null;
    const state = target?.addressState ?? "missing";

    if (!PAYABLE_ADDRESS_STATES.has(state) || !address) {
      skipped.push({
        creatorId,
        grossMinor: bucket.gross,
        owedMinor: owed,
        eventCount: bucket.eventIds.length,
        reason: skipReason(state, address),
        shortfallMinor: BigInt(0),
      });
      continue;
    }

    if (owed < minMinor) {
      skipped.push({
        creatorId,
        grossMinor: bucket.gross,
        owedMinor: owed,
        eventCount: bucket.eventIds.length,
        reason: "below_minimum",
        shortfallMinor: minMinor - owed,
      });
      continue;
    }

    owedTotal += owed;
    platformRemainder += remainder;
    lines.push({
      creatorId,
      address,
      currency: "USDC",
      chain: "base",
      grossMinor: bucket.gross,
      owedMinor: owed,
      roundingRemainder: remainder,
      eventCount: bucket.eventIds.length,
      eventIds: bucket.eventIds,
    });
  }

  lines.sort((a, b) => (a.creatorId < b.creatorId ? -1 : a.creatorId > b.creatorId ? 1 : 0));
  skipped.sort((a, b) => (a.creatorId < b.creatorId ? -1 : a.creatorId > b.creatorId ? 1 : 0));

  return {
    lines,
    skipped,
    totals: {
      grossMinor: grossTotal,
      owedMinor: owedTotal,
      platformRemainder,
      creatorsPaid: lines.length,
      creatorsSkipped: skipped.length,
    },
  };
}

/**
 * Why a creator could not be paid.
 *
 * Spelled out rather than collapsed into one "no address" because these need
 * different actions: a missing address is the creator's to fix, an unverified
 * one is an admin's, and an invalid one is a bug worth finding.
 */
function skipReason(state: PayoutAddressState, address: string | null): string {
  if (state === "ready" && !address) return "no_address";
  if (state === "missing") return "no_address";
  if (state === "invalid") return "address_invalid";
  return "address_unverified";
}

/**
 * The invariant that makes the remainder deliberate rather than lucky.
 *
 * For a positive gross, the paid amount can never exceed the exact share, and
 * the residue is always a genuine fraction of a single minor unit. Called from
 * the route after a live batch and asserted in tests — a batch whose remainder
 * fails this has a bug in `applyBps`, and it is better to hear about it on the
 * run than to find it in a month of reconciliation.
 */
export function assertRemainderInvariants(plan: PayoutPlan, bps: number): void {
  const rate = BigInt(bps);

  for (const line of plan.lines) {
    const exact = (line.grossMinor * rate) / BPS_SCALE;
    if (line.owedMinor > exact) {
      throw new Error(
        `payout rounding bug: ${line.creatorId} was paid ${toAmountString(line.owedMinor)}, which exceeds the exact share ${toAmountString(exact)}`,
      );
    }
    const expectedRemainder = line.grossMinor * rate - line.owedMinor * BPS_SCALE;
    if (line.roundingRemainder !== expectedRemainder) {
      throw new Error(
        `payout rounding bug: ${line.creatorId} recorded a remainder of ${line.roundingRemainder}, expected ${expectedRemainder}`,
      );
    }
    if (line.grossMinor > BigInt(0) && (line.roundingRemainder < BigInt(0) || line.roundingRemainder >= BPS_SCALE)) {
      throw new Error(
        `payout rounding bug: ${line.creatorId} remainder ${line.roundingRemainder} is outside [0, ${BPS_SCALE})`,
      );
    }
  }
}

/** The same remainder check for a plan that is about to be reported but not run. */
export function planAsJson(plan: PayoutPlan, bps: number) {
  assertRemainderInvariants(plan, bps);
  return {
    ...plan,
    totals: {
      ...plan.totals,
      platformRemainder: plan.totals.platformRemainder.toString(),
    },
    lines: plan.lines.map((line) => ({
      ...line,
      grossMinor: toAmountString(line.grossMinor),
      owedMinor: toAmountString(line.owedMinor),
      roundingRemainder: line.roundingRemainder.toString(),
    })),
    skipped: plan.skipped.map((entry) => ({
      ...entry,
      grossMinor: toAmountString(entry.grossMinor),
      owedMinor: toAmountString(entry.owedMinor),
      shortfallMinor: toAmountString(entry.shortfallMinor),
    })),
  };
}
