import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId, type Collection, type Document, type Filter, type Sort } from "mongodb";
import {
  applyBps,
  assertAmount,
  parseAmount,
  readStoredAmount,
  toAmountString,
  USDC_SCALE,
  type Amount,
} from "@/lib/payouts/amount";
import {
  MIN_PAYOUT_MINOR,
  REVENUE_SHARE_BPS,
  type AccrualRow,
  type CreatorPayoutTarget,
} from "@/lib/payouts/payouts";

/**
 * The payout ledger: accruals, batches, and the addresses money goes to.
 *
 * ## The decision this schema encodes
 *
 * Creators accrue in Mongo and get paid weekly in USDC on Base. There is
 * deliberately no per-install on-chain transfer, because an install is a web
 * request: paying per one means paying gas per request, and a component that
 * installs ten thousand times in a week would cost more to settle than it earns.
 * The install is the *event that generates revenue*, not the event that settles
 * anything. x402 is the collection rail for those installs and is out of scope
 * here; this module is the settlement side of the same ledger.
 *
 * ## Three collections, and why not two
 *
 * - `payout_accruals` — the append-only ledger. Every event, forever.
 * - `payout_batches` — one document per (run, creator): what was owed, to
 *   where, and the transaction that moved it.
 * - `payout_accounts` — where a creator's money goes, and whether a human has
 *   checked it.
 *
 * The address table is the reason there are three. It is tempting to hang the
 * destination address off the batch document alone and take it from somewhere
 * else at payout time, but that makes "which address did this go to" a question
 * with two answers: the one on the chain and the one the code thought it was
 * using. Freezing the address onto the batch at the moment of calculation means
 * the batch document is a self-contained receipt, and a later change to a
 * creator's address cannot retroactively alter what a past batch says it did.
 *
 * It is also where the "never take a payout address from a request body"
 * boundary lives: the address is written by the account that owns it or by an
 * admin, and a batch will only pay a state that is `verified`.
 */

/** Why an accrual exists. Constrained because the sign rule depends on it. */
export type AccrualReason =
  | "install"
  | "subscription"
  | "bonus"
  | "adjustment"
  | "clawback";

/** Where the event came from. Part of the idempotency key. */
export type AccrualSource = "x402" | "admin" | "migration" | string;

export type AccrualStatus = "accrued" | "scheduled" | "paid" | "void";

export type PayoutBatchStatus =
  /** Calculated and claimed, but no transaction exists yet. */
  | "planned"
  /** A transaction has been signed. Still reversible in the mempool. */
  | "signed"
  /** Broadcast. Waiting for inclusion. */
  | "submitted"
  /** On-chain. The money is gone and the creator has it. */
  | "confirmed"
  /** The transaction failed or was dropped. The accruals go back to unpaid. */
  | "failed";

export type PayoutAccountStatus = "pending" | "verified" | "rejected";

/* -------------------------------------------------------------------------- */
/*                              Documents                                      */
/* -------------------------------------------------------------------------- */

export type PayoutAccrualDocument = {
  _id?: ObjectId;
  /**
   * The idempotency key. Unique, and the only thing standing between a retried
   * request and a double payment.
   *
   * It is never accepted from a caller — see `buildAccrualIdempotencyKey` —
   * because a caller who chooses the key is a caller who can collide with
   * somebody else's accrual, or re-use a key that already paid to make a
   * second, unrelated payment look like a harmless no-op.
   */
  idempotencyKey: string;
  creatorId: string;
  username?: string;
  componentSlug?: string;
  /** Gross attributable revenue, USDC minor units, stored as BSON Int64. */
  amountMinor: bigint;
  currency: "USDC";
  reason: AccrualReason;
  source: AccrualSource;
  /** The upstream event's identifier — the install id, the charge id. */
  sourceId: string;
  occurredAt: Date;
  status: AccrualStatus;
  /** The batch that claimed this event. `null` means still unpaid. */
  batchId: ObjectId | null;
  recordedBy: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PayoutBatchDocument = {
  _id?: ObjectId;
  /**
   * Identifies one *run* of the weekly batch. Unique together with
   * `creatorId`, so re-running the same run id can never produce a second
   * payment for the same creator — the retry fails at the index instead of at
   * a human noticing a doubled row three weeks later.
   */
  runId: string;
  creatorId: string;
  username?: string;
  currency: "USDC";
  chain: "base";
  /**
   * Frozen at calculation time. A change to the creator's address after this
   * point cannot rewrite what this batch claims it did.
   *
   * There is deliberately no private key field, and no raw signed transaction
   * field either: a signed transaction sitting in a database is a broadcast
   * waiting to happen, readable by anyone with read access, and its contents
   * are public the moment it lands on chain anyway.
   */
  toAddress: string;
  /** What was paid, in USDC minor units. */
  totalMinor: bigint;
  /** Gross it was derived from. Kept so the arithmetic can be re-checked. */
  grossMinor: bigint;
  /** The platform's rounding residue, in 1/10000 of a minor unit. */
  roundingRemainder: bigint;
  eventCount: number;
  eventIds: ObjectId[];
  periodStart: Date;
  /** Exclusive: an accrual at exactly `periodEnd` belongs to the next period. */
  periodEnd: Date;
  status: PayoutBatchStatus;
  txHash?: string | null;
  nonce?: number | null;
  signedAt?: Date | null;
  submittedAt?: Date | null;
  confirmedAt?: Date | null;
  /**
   * A short, non-sensitive description of a failure. Never a stack trace, and
   * never anything derived from key material.
   */
  failureReason?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PayoutAccountDocument = {
  _id?: ObjectId;
  creatorId: string;
  address: string;
  chain: "base";
  status: PayoutAccountStatus;
  requestedAt: Date;
  verifiedAt?: Date | null;
  verifiedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/* -------------------------------------------------------------------------- */
/*                          Hard safety limits                                */
/* -------------------------------------------------------------------------- */

/**
 * A ceiling on a single accrual: one million USDC.
 *
 * Typographical errors are the realistic threat here — a transposed digit in a
 * request that is otherwise perfectly well-formed produces an accrual nine
 * orders of magnitude too large, and every downstream total inherits it. The
 * check is before the write, not after, so a bad request never reaches the
 * ledger at all.
 */
export const MAX_ACCRUAL_MINOR: Amount = USDC_SCALE * BigInt(1_000_000);

/**
 * Raised when the ledger's uniqueness guarantee is not in place.
 *
 * A distinct type because it must never be swallowed by a generic `catch` and
 * turned into a 500 that someone retries — see `assertIdempotencyIndexReady`.
 */
export class PayoutLedgerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayoutLedgerUnavailableError";
  }
}

/* -------------------------------------------------------------------------- */
/*                              Indexes                                       */
/* -------------------------------------------------------------------------- */

/**
 * Whether the payout indexes have been built in this process. Same rationale as
 * `ensureComponentIndexes`: index creation is a migration, not per-request work.
 */
let indexesReady = false;

/** Reset the in-process guard. For tests that rebuild the collections. */
export function resetPayoutIndexes(): void {
  indexesReady = false;
}

type WantedIndex = { key: Record<string, 1 | -1>; unique?: boolean };

const ACCRUAL_INDEXES: WantedIndex[] = [
  // The guarantee. Without it, `insertAccrualOnce` has nothing to collide
  // against and "idempotent" is a comment rather than a behaviour.
  { key: { idempotencyKey: 1 }, unique: true },
  // The creator's own ledger, and the period scan the batch runs.
  { key: { creatorId: 1, occurredAt: -1 } },
  // Settling: find everything already claimed, and by which batch.
  { key: { batchId: 1, occurredAt: -1 } },
  // Per-component revenue reporting.
  { key: { componentSlug: 1, occurredAt: -1 } },
];

const BATCH_INDEXES: WantedIndex[] = [
  // A run id identifies one execution. Together with the creator it makes a
  // whole run re-runnable without being re-payable.
  { key: { runId: 1, creatorId: 1 }, unique: true },
  // The admin history table.
  { key: { createdAt: -1 } },
  { key: { status: 1, createdAt: -1 } },
  // A creator's own payout history.
  { key: { creatorId: 1, createdAt: -1 } },
];

const ACCOUNT_INDEXES: WantedIndex[] = [
  // One destination per creator. Not a compound: the creator *is* the key.
  { key: { creatorId: 1 }, unique: true },
];

/**
 * A collection handle for a name whose document type is not known at the call
 * site.
 *
 * `T` has to satisfy the driver's `Document` constraint — an unconstrained type
 * parameter is rejected by every `Collection<T>` signature, which is the reason
 * this file did not compile. Saying so explicitly is better than widening to
 * `any` and losing the projection types downstream.
 */
async function rawCollection<T extends Document>(name: string): Promise<Collection<T>> {
  const { db } = await connectToDatabase();
  return db.collection<T>(name);
}

/**
 * Create any missing index, matching on the key pattern rather than the name.
 *
 * Same rule as `ensureComponentIndexes`, and for the same reason: an existing
 * deployment carries these indexes under auto-generated names, so a name
 * lookup would never find them. Index specs are append-only — reordering an
 * entry turns `createIndexes` from a no-op into an `IndexOptionsConflict`
 * (code 85) that takes the whole batch down with it.
 */
async function createMissingIndexes<T extends Document>(
  collection: Collection<T>,
  wanted: readonly WantedIndex[],
): Promise<void> {
  const existing = await collection.indexes();
  const pending = wanted.filter((index) => {
    const current = existing.find(
      (entry) => JSON.stringify(entry.key) === JSON.stringify(index.key),
    );
    if (!current) return true;
    return (
      JSON.stringify(current.key) !== JSON.stringify(index.key) ||
      Boolean(current.unique) !== Boolean(index.unique)
    );
  });

  for (const index of pending) {
    await collection.createIndex(index.key, index);
  }
}

/**
 * Confirm the unique index on `idempotencyKey` actually exists.
 *
 * This is where `lib/db/payouts.ts` deliberately parts company with
 * `ensureComponentIndexes`, which logs an index failure and carries on because
 * for a feed the worst case is a slower query.
 *
 * Here the worst case is a ledger that accepts the same economic event twice.
 * "Mostly idempotent, unless the index failed to build" is not idempotency, and
 * the failure is invisible: both rows are individually plausible and the
 * balance is off by exactly one payout. So an index that cannot be built takes
 * the whole accrual path down loudly instead. A payout outage is recoverable;
 * discovering a duplicate payment from a support ticket is not.
 */
async function assertIdempotencyIndexReady(
  collection: Collection<PayoutAccrualDocument>,
): Promise<void> {
  const existing = await collection.indexes();
  const present = existing.some(
    (index) =>
      index.unique === true && JSON.stringify(index.key) === JSON.stringify({ idempotencyKey: 1 }),
  );
  if (!present) {
    throw new PayoutLedgerUnavailableError(
      "the payout accrual ledger has no unique index on idempotencyKey; refusing to accrue, because a retry would pay twice",
    );
  }
}

export async function ensurePayoutIndexes(): Promise<void> {
  if (indexesReady) return;

  const [accruals, batches, accounts] = await Promise.all([
    rawCollection<PayoutAccrualDocument>("payout_accruals"),
    rawCollection<PayoutBatchDocument>("payout_batches"),
    rawCollection<PayoutAccountDocument>("payout_accounts"),
  ]);

  try {
    await Promise.all([
      createMissingIndexes(accruals, ACCRUAL_INDEXES),
      createMissingIndexes(batches, BATCH_INDEXES),
      createMissingIndexes(accounts, ACCOUNT_INDEXES),
    ]);
    await assertIdempotencyIndexReady(accruals);
  } catch (error) {
    throw new PayoutLedgerUnavailableError(
      `payout indexes could not be established: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }

  indexesReady = true;
}

export async function getAccrualCollection(): Promise<Collection<PayoutAccrualDocument>> {
  const collection = await rawCollection<PayoutAccrualDocument>("payout_accruals");
  await ensurePayoutIndexes();
  return collection;
}

export async function getBatchCollection(): Promise<Collection<PayoutBatchDocument>> {
  const collection = await rawCollection<PayoutBatchDocument>("payout_batches");
  await ensurePayoutIndexes();
  return collection;
}

export async function getAccountCollection(): Promise<Collection<PayoutAccountDocument>> {
  const collection = await rawCollection<PayoutAccountDocument>("payout_accounts");
  await ensurePayoutIndexes();
  return collection;
}

/* -------------------------------------------------------------------------- */
/*                          Idempotency key                                  */
/* -------------------------------------------------------------------------- */

/**
 * The idempotency key for one accrual.
 *
 * `<source>:<creatorId>:<sourceId>` — the upstream event's identity, scoped to
 * the creator it is credited to.
 *
 * Why the creator is in the middle rather than left off: an event can in
 * principle be attributed to more than one creator over its life (a component
 * changes hands, a subscription is reassigned), and two creators must both be
 * able to accrue from it. Without the scope, the second one would collide with
 * the first and silently receive nothing. Putting it in the middle also means
 * no caller can construct a key that lands on somebody else's row.
 *
 * Why the source id is required: a key built from `(source, occurredAt)` would
 * collide for any two events in the same millisecond — which is exactly what a
 * batched import produces — and would swallow real revenue. An upstream
 * identifier is the only thing that is unique to the event rather than to the
 * moment we happened to learn about it.
 */
export function buildAccrualIdempotencyKey(input: {
  source: AccrualSource;
  creatorId: string;
  sourceId: string;
}): string {
  const source = input.source.trim();
  const creatorId = input.creatorId.trim();
  const sourceId = input.sourceId.trim();

  if (!source || !creatorId || !sourceId) {
    throw new PayoutLedgerUnavailableError(
      "an accrual needs a source, a creator and a source id to be idempotent",
    );
  }

  // `:` is the separator, so it cannot appear inside a component — otherwise
  // ("a:b", "c") and ("a", "b:c") would build the same key from different
  // events, which is precisely the collision the unique index exists to catch.
  for (const [label, value] of [
    ["source", source],
    ["creatorId", creatorId],
    ["sourceId", sourceId],
  ] as const) {
    if (value.includes(":")) {
      throw new PayoutLedgerUnavailableError(`accrual ${label} must not contain ":"`);
    }
  }

  return `${source}:${creatorId}:${sourceId}`;
}

/* -------------------------------------------------------------------------- */
/*                            Writing accruals                                */
/* -------------------------------------------------------------------------- */

/**
 * The slice of the driver this module uses to make an accrual idempotent.
 *
 * Narrow on purpose: it is impossible for `insertAccrualOnce` to do anything
 * to the collection beyond the one upsert below. A function that took a whole
 * `Collection` would also be able to delete, replace or bulk-write the ledger,
 * and it would be one refactor away from being handed to code that does.
 */
type IdempotentUpsert<T extends Document & { idempotencyKey: string }> = {
  /**
   * The filter is spelled out rather than being `Filter<T>`.
   *
   * `Filter<T>` is a mapped conditional type, and for a *generic* `T` the
   * compiler cannot resolve `{ idempotencyKey: string }` against it — hence the
   * error this signature used to produce. Spelling out the one field the
   * function is allowed to filter on is also the point: this handle exists so a
   * caller cannot do more to the ledger than an idempotent upsert, and a filter
   * it can only ever narrow to a single known event says that in the type.
   */
  findOneAndUpdate(
    filter: { idempotencyKey: string },
    update: { $setOnInsert: T },
    options: {
      upsert: boolean;
      returnDocument: "after";
      includeResultMetadata: true;
    },
  ): Promise<{ value: T | null; lastErrorObject?: { updatedExisting?: boolean } }>;
};

/** MongoDB's duplicate-key error. */
const DUPLICATE_KEY = 11000;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY
  );
}

/**
 * Record one accrual, at most once, ever.
 *
 * The upsert with `$setOnInsert` is atomic in a way a read-then-write is not:
 * `findOne` followed by `insertOne` has a window between the two where a
 * concurrent retry reads "nothing there" and both insert. The unique index is
 * what makes the upsert safe — the update only ever matches the existing row,
 * and a second writer blocks on the index rather than racing past it.
 *
 * Two outcomes mean "already recorded", and both have to be handled because
 * they correspond to two different races:
 *
 * - `updatedExisting === true` — a sequential retry. The caller's own earlier
 *   call already wrote this key.
 * - E11000 — a *concurrent* retry. Both callers passed the filter before
 *   either wrote, and the index rejected the loser. This is the case a naive
 *   implementation treats as a 500, which is how a retried payout request turns
 *   into an incident.
 */
export async function insertAccrualOnce<T extends Document & { idempotencyKey: string }>(
  collection: IdempotentUpsert<T>,
  doc: T,
): Promise<{ created: boolean; event: T }> {
  let result: { value: T | null; lastErrorObject?: { updatedExisting?: boolean } };

  try {
    result = await collection.findOneAndUpdate(
      { idempotencyKey: doc.idempotencyKey },
      { $setOnInsert: doc },
      { upsert: true, returnDocument: "after", includeResultMetadata: true },
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    // Lost the concurrent race. The winner's row is the truth; return it so
    // the caller reports the same "already recorded" it would have reported
    // had it arrived a millisecond later.
    const existing = await collection.findOneAndUpdate(
      { idempotencyKey: doc.idempotencyKey },
      { $setOnInsert: doc },
      { upsert: true, returnDocument: "after", includeResultMetadata: true },
    );
    if (!existing.value) throw error;
    return { created: false, event: existing.value };
  }

  const alreadyExisted = result.lastErrorObject?.updatedExisting === true;
  const event = result.value;
  if (!event) {
    // An upsert that returns no document has not been written, and saying
    // otherwise would let a caller report a payment that is not in the ledger.
    throw new PayoutLedgerUnavailableError("accrual upsert returned no document");
  }

  return { created: !alreadyExisted, event };
}

export type RecordAccrualInput = {
  creatorId: string;
  username?: string;
  componentSlug?: string;
  /** Accepts a decimal string or an integer. A float is a 400. */
  amountMinor: unknown;
  reason: AccrualReason;
  source: AccrualSource;
  sourceId: string;
  occurredAt?: Date;
  recordedBy: string;
  note?: string;
};

/**
 * Record an accrual, idempotently.
 *
 * The sign rule is enforced here rather than at the route: `clawback` is the
 * only reason that may be negative, and an install that credits a creator money
 * is a bug that must not be able to hide behind a valid-looking request. The
 * rule belongs next to the write, because this is the only function that
 * writes.
 */
export async function recordAccrual(
  input: RecordAccrualInput,
): Promise<{ created: boolean; event: PayoutAccrualDocument }> {
  const collection = await getAccrualCollection();

  const amount = parseAmount(input.amountMinor, "amountMinor");
  if (amount === BigInt(0)) {
    throw new PayoutLedgerUnavailableError("an accrual of zero has no meaning");
  }
  if (input.reason === "clawback" ? amount > BigInt(0) : amount < BigInt(0)) {
    throw new PayoutLedgerUnavailableError(
      `a ${input.reason} accrual must ${input.reason === "clawback" ? "reduce" : "increase"} the creator's balance`,
    );
  }
  if (amount > MAX_ACCRUAL_MINOR || amount < -MAX_ACCRUAL_MINOR) {
    throw new PayoutLedgerUnavailableError("accrual amount exceeds the per-event ceiling");
  }

  const now = new Date();
  const doc: PayoutAccrualDocument = {
    idempotencyKey: buildAccrualIdempotencyKey({
      source: input.source,
      creatorId: input.creatorId,
      sourceId: input.sourceId,
    }),
    creatorId: input.creatorId,
    username: input.username,
    componentSlug: input.componentSlug,
    amountMinor: amount,
    currency: "USDC",
    reason: input.reason,
    source: input.source,
    sourceId: input.sourceId,
    occurredAt: input.occurredAt ?? now,
    status: "accrued",
    batchId: null,
    recordedBy: input.recordedBy,
    note: input.note,
    createdAt: now,
    updatedAt: now,
  };

  // Explicit: `T` is inferred from a *method* signature in `IdempotentUpsert`,
  // and inference cannot pick it up through `Collection`'s overloads reliably —
  // without this the return type widens to a bare object literal and stops
  // being a `PayoutAccrualDocument`.
  return insertAccrualOnce<PayoutAccrualDocument>(collection, doc);
}

/* -------------------------------------------------------------------------- */
/*                             Reading accruals                               */
/* -------------------------------------------------------------------------- */

/** An unpaid accrual, ready for the batch calculation. */
export type UnpaidAccrual = AccrualRow & {
  /** Whether a negative event (a clawback) offsets positives in the same period. */
  signed: boolean;
};

/**
 * Unpaid accruals for a period: `[periodStart, periodEnd)`, half-open.
 *
 * Half-open rather than inclusive at both ends because a batch that ran
 * exactly on a boundary and the next batch that starts from that same instant
 * would otherwise both claim the accruals landing on it. The overlap is one
 * document, paid twice, which is the whole failure this endpoint exists to
 * make impossible.
 */
export async function listUnpaidAccruals(options: {
  periodStart: Date;
  periodEnd: Date;
  /** Ceiling so a corrupt date range cannot pull the entire ledger into memory. */
  limit?: number;
}): Promise<UnpaidAccrual[]> {
  const collection = await getAccrualCollection();
  const limit = Math.min(Math.max(options.limit ?? 10_000, 1), 50_000);

  const filter: Filter<PayoutAccrualDocument> = {
    batchId: null,
    status: "accrued",
    occurredAt: { $gte: options.periodStart, $lt: options.periodEnd },
  };

  const orderBy: Sort = { occurredAt: 1, _id: 1 };
  const rows = await collection.find(filter).sort(orderBy).limit(limit).toArray();

  return rows.map((row) => ({
    id: row._id?.toString() ?? "",
    creatorId: row.creatorId,
    amountMinor: readStoredAmount(row.amountMinor, `accrual ${row._id}`),
    occurredAt: row.occurredAt,
    signed: row.amountMinor < BigInt(0),
  }));
}

/** Where each creator in a batch would be paid. */
export async function listPayoutTargets(
  creatorIds: readonly string[],
): Promise<CreatorPayoutTarget[]> {
  if (!creatorIds.length) return [];

  const collection = await getAccountCollection();
  const rows = await collection
    .find({ creatorId: { $in: [...creatorIds] } })
    .toArray();

  return rows.map((row) => ({
    creatorId: row.creatorId,
    address: row.address,
    addressState:
      row.status === "verified" ? "ready" : row.status === "rejected" ? "invalid" : "unverified",
  }));
}

/* -------------------------------------------------------------------------- */
/*                                Balances                                    */
/* -------------------------------------------------------------------------- */

export type CreatorBalance = {
  creatorId: string;
  /** Gross attributable revenue, everything ever recorded. */
  grossAccruedMinor: Amount;
  /** Gross that has been settled in a confirmed batch. */
  settledMinor: Amount;
  /** Gross sitting in a batch that is not confirmed yet. */
  inFlightMinor: Amount;
  /** Gross recorded but not yet claimed by any batch — this is what carries forward. */
  pendingMinor: Amount;
  /** What the pending gross would be worth at the current share. */
  estimatedOwedMinor: Amount;
  /** True when that estimate clears the payout threshold. */
  readyToPay: boolean;
  accrualCount: number;
  lastAccrualAt: Date | null;
  /** The address currently on file, if any. */
  address: string | null;
  addressStatus: PayoutAccountStatus | null;
};

/**
 * One creator's balance, in one aggregation.
 *
 * Scoped by `creatorId` on every stage, including the ones that look global.
 * There is no code path in this function that can return another creator's
 * totals — which is not a style preference, it is the only thing standing
 * between this endpoint and being a way to enumerate what everybody earns.
 *
 * The sums come back as Int64 and are coerced with `readStoredAmount`, which
 * throws rather than accepting a lossy double. A balance that cannot be read
 * exactly is a balance we cannot pay from.
 */
export async function getCreatorBalance(creatorId: string): Promise<CreatorBalance> {
  const [accruals, batches, account] = await Promise.all([
    getAccrualCollection(),
    getBatchCollection(),
    getAccountCollection(),
  ]);

  const [accrualRow, batchRow] = await Promise.all([
    accruals
      .aggregate<{
        gross: number | bigint;
        count: number;
        pending: number | bigint;
        last: Date;
      }>([
        { $match: { creatorId } },
        {
          $group: {
            _id: null,
            gross: { $sum: "$amountMinor" },
            pending: {
              $sum: { $cond: [{ $eq: ["$batchId", null] }, "$amountMinor", 0] },
            },
            count: { $sum: { $cond: [{ $eq: ["$status", "void"] }, 0, 1] } },
            last: { $max: "$occurredAt" },
          },
        },
      ])
      .toArray(),
    batches
      .aggregate<{
        settled: number | bigint;
        inFlight: number | bigint;
      }>([
        { $match: { creatorId } },
        {
          $group: {
            _id: null,
            settled: { $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, "$totalMinor", 0] } },
            inFlight: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["planned", "signed", "submitted"]] },
                  "$totalMinor",
                  0,
                ],
              },
            },
          },
        },
      ])
      .toArray(),
  ]);

  const accountRow = await account.findOne({ creatorId });

  const grossAccruedMinor = readStoredAmount(accrualRow[0]?.gross ?? BigInt(0), "gross accrued");
  const pendingMinor = readStoredAmount(accrualRow[0]?.pending ?? BigInt(0), "pending gross");
  const settledMinor = readStoredAmount(batchRow[0]?.settled ?? BigInt(0), "settled total");
  const inFlightMinor = readStoredAmount(batchRow[0]?.inFlight ?? BigInt(0), "in-flight total");
  const estimatedOwedMinor = applyBps(pendingMinor, REVENUE_SHARE_BPS).amount;

  return {
    creatorId,
    grossAccruedMinor,
    settledMinor,
    inFlightMinor,
    pendingMinor,
    estimatedOwedMinor,
    readyToPay: estimatedOwedMinor >= MIN_PAYOUT_MINOR,
    accrualCount: accrualRow[0]?.count ?? 0,
    lastAccrualAt: accrualRow[0]?.last ?? null,
    address: accountRow?.address ?? null,
    addressStatus: accountRow?.status ?? null,
  };
}

/**
 * A creator's own payout history, newest first.
 *
 * Only ever called with a session-derived id. There is no `creatorId` parameter
 * on any route that reaches this, which is a stronger guarantee than a filter
 * someone could forget to add.
 */
export async function listCreatorBatches(
  creatorId: string,
  limit = 25,
): Promise<PayoutBatchDocument[]> {
  const collection = await getBatchCollection();
  const orderBy: Sort = { createdAt: -1, _id: -1 };
  return collection
    .find({ creatorId })
    .sort(orderBy)
    .limit(Math.min(Math.max(limit, 1), 100))
    .toArray();
}

/** A creator's own accrual history, newest first. */
export async function listCreatorAccruals(
  creatorId: string,
  limit = 25,
): Promise<PayoutAccrualDocument[]> {
  const collection = await getAccrualCollection();
  const orderBy: Sort = { occurredAt: -1, _id: -1 };
  return collection
    .find({ creatorId })
    .sort(orderBy)
    .limit(Math.min(Math.max(limit, 1), 100))
    .toArray();
}

/** Every batch, for the admin history table. Admin-only callers only. */
export async function listBatches(options: { limit?: number; status?: PayoutBatchStatus } = {}) {
  const collection = await getBatchCollection();
  const filter: Filter<PayoutBatchDocument> = options.status ? { status: options.status } : {};
  const orderBy: Sort = { createdAt: -1, _id: -1 };
  return collection
    .find(filter)
    .sort(orderBy)
    .limit(Math.min(Math.max(options.limit ?? 100, 1), 500))
    .toArray();
}

/* -------------------------------------------------------------------------- */
/*                              Payout accounts                                */
/* -------------------------------------------------------------------------- */

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

/**
 * Whether a string is shaped like an EVM address.
 *
 * Shape only — this is not a checksum, and it does not prove the address
 * belongs to anybody. That is what `PayoutAccountStatus` is for: an address is
 * only ever paid once a human has confirmed it, and this check exists to keep
 * obvious garbage out of the table before it reaches that human, not to
 * substitute for them.
 */
export function isEvmAddress(value: unknown): value is string {
  return typeof value === "string" && EVM_ADDRESS.test(value.trim());
}

/**
 * Record or replace a creator's payout address.
 *
 * `status` is `pending` for a creator setting their own — the creator is
 * asserting a destination, not approving one, and a self-service address change
 * on a payout rail is exactly the shape of an account-takeover payout. An admin
 * verifying it is a separate call.
 */
export async function putPayoutAccount(input: {
  creatorId: string;
  address: string;
  status: PayoutAccountStatus;
  actorId: string;
}): Promise<PayoutAccountDocument> {
  const collection = await getAccountCollection();
  const address = input.address.trim();

  if (!isEvmAddress(address)) {
    throw new PayoutLedgerUnavailableError("a payout address must be a 0x-prefixed 40-digit EVM address");
  }

  const now = new Date();
  const verified = input.status === "verified";

  const result = await collection.findOneAndUpdate(
    { creatorId: input.creatorId },
    {
      $set: {
        creatorId: input.creatorId,
        address,
        chain: "base",
        status: input.status,
        updatedAt: now,
        ...(verified
          ? { verifiedAt: now, verifiedBy: input.actorId }
          : { verifiedAt: null, verifiedBy: null }),
      },
      $setOnInsert: { requestedAt: now, createdAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!result) throw new PayoutLedgerUnavailableError("payout address could not be saved");
  return result;
}

export async function getPayoutAccount(creatorId: string): Promise<PayoutAccountDocument | null> {
  const collection = await getAccountCollection();
  return collection.findOne({ creatorId });
}

/* -------------------------------------------------------------------------- */
/*                          Settling a batch (stub)                           */
/* -------------------------------------------------------------------------- */

export type BatchWriteResult = {
  runId: string;
  created: number;
  /** Lines the plan produced but the unique index rejected as already paid. */
  duplicates: number;
  /** Event ids the claiming step could not claim, because something else took them. */
  unclaimed: string[];
};

/**
 * Write the batch and claim its accruals.
 *
 * Ordering matters and is not interchangeable: the accruals are claimed first,
 * under a batch id that no `payout_batches` document has yet. If the process
 * dies in between, the accruals are marked `scheduled` and point at a batch
 * that does not exist — a state an operator can find and reconcile, and which
 * pays nobody twice. The other order would leave a batch document claiming
 * events that are still unpaid and available to the next run, which pays them
 * twice and leaves the first batch's recipient unpaid.
 */
export async function writeBatch(input: {
  runId: string;
  periodStart: Date;
  periodEnd: Date;
  lines: readonly {
    creatorId: string;
    username?: string;
    address: string;
    grossMinor: Amount;
    owedMinor: Amount;
    roundingRemainder: bigint;
    eventIds: string[];
  }[];
  createdBy: string;
}): Promise<BatchWriteResult> {
  const [accruals, batches] = await Promise.all([getAccrualCollection(), getBatchCollection()]);
  const now = new Date();
  const unclaimed: string[] = [];
  let created = 0;
  let duplicates = 0;

  for (const line of input.lines) {
    const objectIds = line.eventIds
      .map((id) => (ObjectId.isValid(id) ? new ObjectId(id) : null))
      .filter((id): id is ObjectId => id !== null);

    const batchId = new ObjectId();

    const claim = await accruals.updateMany(
      // `batchId: null` is the whole concurrency control: two runs computing
      // over the same events both try to claim, and the second one matches
      // nothing because the first already flipped it.
      { _id: { $in: objectIds }, batchId: null },
      { $set: { batchId, status: "scheduled", updatedAt: now } },
    );

    const claimedCount = claim.modifiedCount;
    if (claimedCount !== objectIds.length) {
      // Partial claim means somebody else got there first for some of these.
      // Recording which ids failed is the difference between a reconcilable
      // batch and a silent double payment.
      const stillFree = await accruals
        .find({ _id: { $in: objectIds }, batchId: null })
        .project<{ _id: ObjectId }>({ _id: 1 })
        .toArray();
      unclaimed.push(...stillFree.map((row) => row._id.toString()));
      await accruals.updateMany({ batchId }, { $set: { batchId: null, status: "accrued", updatedAt: now } });
      continue;
    }

    const doc: PayoutBatchDocument = {
      runId: input.runId,
      creatorId: line.creatorId,
      username: line.username,
      currency: "USDC",
      chain: "base",
      toAddress: line.address,
      totalMinor: line.owedMinor,
      grossMinor: line.grossMinor,
      roundingRemainder: line.roundingRemainder,
      eventCount: objectIds.length,
      eventIds: objectIds,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      status: "planned",
      txHash: null,
      nonce: null,
      signedAt: null,
      submittedAt: null,
      confirmedAt: null,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await batches.insertOne(doc);
      created += 1;
    } catch (error) {
      // Same run id, same creator, already paid by an earlier attempt. Give the
      // events back so they are not stranded against a batch that will never
      // include them.
      await accruals.updateMany(
        { batchId },
        { $set: { batchId: null, status: "accrued", updatedAt: now } },
      );
      if (isDuplicateKeyError(error)) {
        duplicates += 1;
        continue;
      }
      throw error;
    }
  }

  return { runId: input.runId, created, duplicates, unclaimed };
}

/**
 * Move a batch along its lifecycle.
 *
 * Only the fields below can be written. In particular there is no way to set a
 * private key, a signature, or a raw transaction, and there is no way to change
 * `toAddress` or `totalMinor` after creation — a batch that has been calculated
 * is a receipt, and editing it is how a ledger stops being able to prove what
 * it did.
 */
export async function updateBatchStatus(
  batchId: string,
  patch: {
    status?: PayoutBatchStatus;
    txHash?: string | null;
    nonce?: number | null;
    failureReason?: string;
  },
): Promise<void> {
  const collection = await getBatchCollection();
  if (!ObjectId.isValid(batchId)) {
    throw new PayoutLedgerUnavailableError("invalid batch id");
  }

  const now = new Date();
  const set: Record<string, unknown> = { updatedAt: now };

  if (patch.status) {
    set.status = patch.status;
    if (patch.status === "signed") set.signedAt = now;
    if (patch.status === "submitted") set.submittedAt = now;
    if (patch.status === "confirmed") set.confirmedAt = now;
  }
  if (patch.txHash !== undefined) set.txHash = patch.txHash;
  if (patch.nonce !== undefined) set.nonce = patch.nonce;
  if (patch.failureReason !== undefined) set.failureReason = patch.failureReason;

  await collection.updateOne({ _id: new ObjectId(batchId) }, { $set: set });
}

/**
 * Serialise a batch document for a response body.
 *
 * Amounts go out as decimal strings because `JSON.stringify` throws on a
 * bigint — a throw inside a *successful* response, which reads to the caller as
 * "the payout system is broken" rather than as a bug in a serialiser.
 *
 * Nothing here emits a full ledger balance for anybody but the subject of the
 * request, and `failureReason` is a short operator-written string that must
 * never carry key material or a signature.
 */
export function batchToJson(batch: PayoutBatchDocument) {
  return {
    id: batch._id?.toString() ?? null,
    runId: batch.runId,
    creatorId: batch.creatorId,
    username: batch.username ?? null,
    currency: batch.currency,
    chain: batch.chain,
    toAddress: batch.toAddress,
    totalMinor: toAmountString(readStoredAmount(batch.totalMinor, "batch total")),
    grossMinor: toAmountString(readStoredAmount(batch.grossMinor, "batch gross")),
    roundingRemainder: batch.roundingRemainder.toString(),
    eventCount: batch.eventCount,
    periodStart: batch.periodStart?.toISOString() ?? null,
    periodEnd: batch.periodEnd?.toISOString() ?? null,
    status: batch.status,
    txHash: batch.txHash ?? null,
    nonce: batch.nonce ?? null,
    createdAt: batch.createdAt?.toISOString() ?? null,
    failureReason: batch.failureReason ?? null,
  };
}

/** Serialise an accrual for a response body. */
export function accrualToJson(event: PayoutAccrualDocument) {
  return {
    id: event._id?.toString() ?? null,
    componentSlug: event.componentSlug ?? null,
    amountMinor: toAmountString(readStoredAmount(event.amountMinor, "accrual amount")),
    currency: event.currency,
    reason: event.reason,
    source: event.source,
    sourceId: event.sourceId,
    occurredAt: event.occurredAt?.toISOString() ?? null,
    status: event.status,
    createdAt: event.createdAt?.toISOString() ?? null,
  };
}

/** Serialise a creator balance. Only ever for the creator it belongs to. */
export function balanceToJson(balance: CreatorBalance) {
  return {
    creatorId: balance.creatorId,
    currency: "USDC",
    grossAccruedMinor: toAmountString(balance.grossAccruedMinor),
    settledMinor: toAmountString(balance.settledMinor),
    inFlightMinor: toAmountString(balance.inFlightMinor),
    pendingMinor: toAmountString(balance.pendingMinor),
    estimatedOwedMinor: toAmountString(balance.estimatedOwedMinor),
    readyToPay: balance.readyToPay,
    accrualCount: balance.accrualCount,
    lastAccrualAt: balance.lastAccrualAt?.toISOString() ?? null,
    address: balance.address,
    addressStatus: balance.addressStatus,
  };
}
