import { randomBytes } from "node:crypto";

import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";

import {
  AmountError,
  applyBps,
  parseAmount,
  readStoredAmount,
  toAmountString,
  USDC_SCALE,
  type Amount,
} from "../payouts/amount";
import {
  MIN_PAYOUT_MINOR,
  REVENUE_SHARE_BPS,
  type AccrualRow,
  type CreatorPayoutTarget,
} from "../payouts/payouts";

import { db } from "./postgres";
import { payoutAccruals, payoutAccounts, payoutBatches } from "./schema";

/**
 * The payout ledger: accruals, batches, and the addresses money goes to.
 *
 * ## The decision this schema encodes
 *
 * Creators accrue in Postgres and get paid weekly in USDC on Base. There is
 * deliberately no per-install on-chain transfer, because an install is a web
 * request: paying per one means paying gas per request, and a component that
 * installs ten thousand times in a week would cost more to settle than it earns.
 * The install is the *event that generates revenue*, not the event that settles
 * anything. x402 is the collection rail for those installs and is out of scope
 * here; this module is the settlement side of the same ledger.
 *
 * ## Three tables, and why not two
 *
 * `payout_accruals` is the append-only ledger: every event, forever.
 * `payout_batches` holds one row per (run, creator) — what was owed, to where,
 * and the transaction that moved it. `payout_accounts` says where a creator's
 * money goes, and whether a human has checked it.
 *
 * The address table is the reason there are three. It is tempting to hang the
 * destination address off the batch row alone and take it from somewhere else
 * at payout time, but that makes "which address did this go to" a question with
 * two answers: the one on the chain and the one the code thought it was using.
 * Freezing the address onto the batch at the moment of calculation means the
 * batch row is a self-contained receipt, and a later change to a creator's
 * address cannot retroactively alter what a past batch says it did.
 *
 * It is also where the "never take a payout address from a request body"
 * boundary lives: the address is written by the account that owns it or by an
 * admin, and a batch will only pay a state that is `verified`.
 *
 * ## What the tables cannot hold
 *
 * The amounts are text columns, because the arithmetic is on bigints and a
 * bigint does not fit a double. Every sum in this module therefore happens in
 * the database as `bigint` and comes back as the exact decimal string it was
 * written as, and the reader refuses anything that is not an integer.
 *
 * Three fields of the old documents have no column: an accrual's `recordedBy`
 * and its `updatedAt`, and a batch's list of the events it covers. Nothing
 * reads them, and inventing a column for a field nobody reads is how a ledger
 * grows a shape that has to be migrated again later. The two accrual fields
 * are carried in the value a write returns and are absent when a row is read
 * back; the batch's events are read back from the accruals that carry the
 * batch that claimed them, which is the same claim seen from the other side.
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
  /**
   * The row's id, as text.
   *
   * It was an object id and the migration carried the same twenty-four
   * characters over, so a lookup compares the string the caller holds instead
   * of building an id out of it.
   */
  _id?: string;
  /**
   * The idempotency key. Unique, and the only thing standing between a retried
   * request and a double payment.
   *
   * It is never accepted from a caller — see `buildAccrualIdempotencyKey` —
   * because a caller who chooses the key is a caller who can collide with
   * somebody else's accrual, or re-use a key that already paid to make a
   * second, unrelated payment look like a harmless no-op.
   *
   * There is no column for it. The uniqueness it describes is the unique index
   * on `(source, source_id)`, and the key is rebuilt from those columns every
   * time a row is read.
   */
  idempotencyKey: string;
  creatorId: string;
  username?: string;
  componentSlug?: string;
  /** Gross attributable revenue, USDC minor units. */
  amountMinor: bigint;
  currency: "USDC";
  reason: AccrualReason;
  source: AccrualSource;
  /** The upstream event's identifier — the install id, the charge id. */
  sourceId: string;
  occurredAt: Date;
  status: AccrualStatus;
  /** The batch that claimed this event. `null` means still unpaid. */
  batchId: string | null;
  /** Who asked for the accrual. The table has no column for it. */
  recordedBy?: string;
  note?: string;
  createdAt: Date;
  /** The table has no column for it either. */
  updatedAt?: Date;
};

export type PayoutBatchDocument = {
  _id?: string;
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
  /**
   * The events this batch covers.
   *
   * There is no column for the list either: the accrual rows carry the batch
   * that claimed them, so the list is read back from them.
   */
  eventIds: string[];
  periodStart: Date | null;
  /** Exclusive: an accrual at exactly `periodEnd` belongs to the next period. */
  periodEnd: Date | null;
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
  /**
   * The account's key, which is the creator. There is one address per creator
   * and the creator is what it is keyed by, so there is no second id to keep.
   */
  _id?: string;
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
 * turned into a 500 that someone retries — see `insertAccrualOnce`, which
 * refuses to report an accrual it cannot prove it wrote.
 */
export class PayoutLedgerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayoutLedgerUnavailableError";
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Ids                                       */
/* -------------------------------------------------------------------------- */

/**
 * The shape of a ledger id: twenty-four hex characters.
 *
 * The migrated rows carry the object ids they had, so the ids in the table are
 * all one shape and a string that is not that shape is not an id. Comparing it
 * as text is what the lookup does now; building an object id out of it is what
 * it did before.
 */
const LEDGER_ID = /^[0-9a-f]{24}$/i;

function isLedgerId(value: unknown): value is string {
  return typeof value === "string" && LEDGER_ID.test(value);
}

/**
 * A new ledger id: twelve random bytes, hex.
 *
 * The first four bytes are the current second, which is what makes the ids
 * sort by the moment they were minted — the property the old object ids had,
 * and the one the `createdAt` ordering leans on when two rows share a
 * timestamp. The rest is random, so two ids minted in the same second are
 * still two ids.
 */
function newLedgerId(): string {
  const bytes = randomBytes(12);
  bytes.writeUInt32BE(Math.floor(Date.now() / 1000), 0);
  return bytes.toString("hex");
}

/* -------------------------------------------------------------------------- */
/*                              Indexes                                       */
/* -------------------------------------------------------------------------- */

/**
 * Whether the payout indexes have been checked in this process. Same rationale
 * as `ensureComponentIndexes`: index creation is a migration, not per-request
 * work.
 */
let indexesReady = false;

/** Reset the in-process guard. For tests that rebuild the collections. */
export function resetPayoutIndexes(): void {
  indexesReady = false;
}

/**
 * Confirm that the ledger's indexes are in place.
 *
 * The indexes are declared in the schema and already exist in the database, so
 * this creates nothing: a table either exists with its constraints or it does
 * not exist at all, and there is no runtime work left to do here.
 *
 * The Mongo version built its indexes on the way in and refused to accrue
 * without them, because in Mongo an index is a thing a collection may or may
 * not have. In Postgres the guarantee is the schema's, and the one that
 * matters — the unique index on `(source, source_id)` — is what makes the
 * conflict-tolerant insert in `insertAccrualOnce` a guarantee rather than a
 * hope.
 */
export async function ensurePayoutIndexes(): Promise<void> {
  if (indexesReady) return;
  indexesReady = true;
}

/* -------------------------------------------------------------------------- */
/*                              Collections                                   */
/* -------------------------------------------------------------------------- */

/** The connected database, as the client hands it back. */
type Database = ReturnType<typeof db>;

/** The rows, as the tables hand them back. */
type AccrualRecord = typeof payoutAccruals.$inferSelect;
type BatchRecord = typeof payoutBatches.$inferSelect;
type AccountRecord = typeof payoutAccounts.$inferSelect;

/**
 * A page of payout accounts, in the order the admin table asks for.
 *
 * The admin route still speaks the old query vocabulary — a filter, a sort, a
 * limit — and it cannot be changed from here, so the handle answers in that
 * vocabulary rather than in the table's. It is a thin seam over the same
 * table the rest of this module reads.
 */
export type PayoutAccountQuery = {
  sort(spec: { status?: 1 | -1; updatedAt?: 1 | -1 }): PayoutAccountQuery;
  limit(count: number): PayoutAccountQuery;
  toArray(): Promise<PayoutAccountDocument[]>;
};

/** The accounts table, as the admin route asks for it. */
export type PayoutAccountCollection = {
  find(filter: { creatorId?: string }): PayoutAccountQuery;
};

/**
 * The accounts table, and the handle to read it through.
 *
 * The call to `db()` is not decoration. A missing `DATABASE_URL` has to throw
 * from here, the way a missing `MONGODB_URI` threw from the Mongo connection,
 * because the callers catch that error and answer with a degraded response
 * rather than a crash.
 */
export async function getAccountCollection(): Promise<PayoutAccountCollection> {
  const client = db();
  await ensurePayoutIndexes();
  return accountCollection(client);
}

function accountCollection(client: Database): PayoutAccountCollection {
  return {
    find(filter) {
      let sortSpec: { status?: 1 | -1; updatedAt?: 1 | -1 } = {};
      let max = 0;

      const query: PayoutAccountQuery = {
        sort(spec) {
          sortSpec = spec;
          return query;
        },
        limit(count) {
          max = count;
          return query;
        },
        async toArray() {
          const order = [];
          if (sortSpec.status) {
            order.push(
              sortSpec.status === 1
                ? asc(payoutAccounts.status)
                : desc(payoutAccounts.status),
            );
          }
          if (sortSpec.updatedAt) {
            order.push(
              sortSpec.updatedAt === 1
                ? asc(payoutAccounts.updatedAt)
                : desc(payoutAccounts.updatedAt),
            );
          }

          const query = client
            .select()
            .from(payoutAccounts)
            .where(
              filter.creatorId ? eq(payoutAccounts.creatorId, filter.creatorId) : undefined,
            )
            .orderBy(...order);

          const rows = max > 0 ? await query.limit(max) : await query;

          return rows.map(toAccountDocument);
        },
      };

      return query;
    },
  };
}

/**
 * The accrual table.
 *
 * The indexes live in the schema, so there is nothing to build here. The call
 * to `db()` is not decoration: an unconfigured deployment has to fail here,
 * the way it failed when the connection was made.
 */
export async function getAccrualCollection(): Promise<typeof payoutAccruals> {
  db();
  await ensurePayoutIndexes();
  return payoutAccruals;
}

/** The batch table, for the same reason as the accrual table. */
export async function getBatchCollection(): Promise<typeof payoutBatches> {
  db();
  await ensurePayoutIndexes();
  return payoutBatches;
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
 *
 * This is the document's label rather than the database's constraint. The
 * unique index the ledger keeps is on `(source, source_id)`, so the creator
 * scope this key carries is a scope the database does not enforce: one
 * upstream event cannot be credited twice, not even to two different
 * creators. The key says who an event is for; the index says the event is
 * already spoken for.
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

/**
 * The idempotency key of a stored row, rebuilt from its columns.
 *
 * The key is not a column, so it is recomposed rather than read. This is the
 * one place where the two halves of the story meet: the key names the creator
 * as well as the event, while the unique index the database keeps is on the
 * event alone.
 */
function accrualKeyOf(row: AccrualRecord): string {
  return `${row.source}:${row.creatorId}:${row.sourceId}`;
}

/* -------------------------------------------------------------------------- */
/*                            Writing accruals                                */
/* -------------------------------------------------------------------------- */

/**
 * The slice of the database this module uses to make an accrual idempotent.
 *
 * Narrow on purpose: it is impossible for `insertAccrualOnce` to do anything
 * to the ledger beyond the one insert below and the read that answers it. A
 * handle that could delete or rewrite rows would be one refactor away from
 * being handed to code that does.
 */
export type IdempotentAccrualWriter = {
  /** Insert the accrual, unless one already exists for this event. */
  insertOnce(values: typeof payoutAccruals.$inferInsert): Promise<AccrualRecord[]>;
  /** The row that owns this event, if there is one. */
  findByEvent(source: string, sourceId: string): Promise<AccrualRecord[]>;
};

function accrualWriter(client: Database): IdempotentAccrualWriter {
  return {
    async insertOnce(values) {
      return client
        .insert(payoutAccruals)
        .values(values)
        // The unique index on `(source, source_id)` is the guarantee, and this
        // is the insert that leans on it: a second writer for the same event
        // is turned away by the index rather than by a read that a concurrent
        // writer could slip past.
        .onConflictDoNothing({
          target: [payoutAccruals.source, payoutAccruals.sourceId],
        })
        .returning();
    },
    async findByEvent(source, sourceId) {
      return client
        .select()
        .from(payoutAccruals)
        .where(
          and(
            eq(payoutAccruals.source, source),
            eq(payoutAccruals.sourceId, sourceId),
          ),
        )
        .limit(1);
    },
  };
}

/**
 * Record one accrual, at most once, ever.
 *
 * The insert is atomic in a way a read-then-write is not: `select` followed
 * by `insert` has a window between the two where a concurrent retry reads
 * "nothing there" and both insert. The unique index is what makes the insert
 * safe — the conflict is turned away by the index, and the loser is answered
 * with the winner's row.
 *
 * Two outcomes mean "already recorded", and both have to be handled because
 * they correspond to two different races:
 *
 * - the insert returned a row — the accrual is new.
 * - the insert returned nothing and the event is already on file — a
 *   sequential retry, or a *concurrent* one that lost the race. The winner's
 *   row is the truth, and it is returned so the caller reports the same
 *   "already recorded" it would have reported had it arrived a millisecond
 *   later. This is the case a naive implementation treats as a 500, which is
 *   how a retried payout request turns into an incident.
 */
export async function insertAccrualOnce(
  writer: IdempotentAccrualWriter,
  doc: PayoutAccrualDocument,
): Promise<{ created: boolean; event: PayoutAccrualDocument }> {
  const inserted = await writer.insertOnce(accrualValues(doc));

  if (inserted.length > 0) {
    // `recordedBy` and `updatedAt` have no column to live in, so they are
    // carried here rather than read back. On the path below — where the row
    // was written by somebody else — they are absent, because what is
    // honestly known about that row is what the table holds.
    return {
      created: true,
      event: {
        ...toAccrualDocument(inserted[0]),
        recordedBy: doc.recordedBy,
        updatedAt: doc.updatedAt,
      },
    };
  }

  const existing = await writer.findByEvent(doc.source, doc.sourceId);
  if (!existing[0]) {
    // An insert that returns no document has not been written, and saying
    // otherwise would let a caller report a payment that is not in the ledger.
    throw new PayoutLedgerUnavailableError("accrual insert returned no document");
  }

  return { created: false, event: toAccrualDocument(existing[0]) };
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
  const client = db();
  await ensurePayoutIndexes();

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
    _id: newLedgerId(),
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

  return insertAccrualOnce(accrualWriter(client), doc);
}

/** The row an accrual document becomes. */
function accrualValues(doc: PayoutAccrualDocument): typeof payoutAccruals.$inferInsert {
  return {
    id: doc._id ?? newLedgerId(),
    creatorId: doc.creatorId,
    username: doc.username ?? null,
    componentSlug: doc.componentSlug ?? null,
    amountMinor: doc.amountMinor.toString(10),
    reason: doc.reason,
    source: doc.source,
    sourceId: doc.sourceId,
    batchId: doc.batchId ?? null,
    status: doc.status,
    note: doc.note ?? null,
    occurredAt: doc.occurredAt,
    createdAt: doc.createdAt,
  };
}

/** The row as the document callers expect. */
function toAccrualDocument(row: AccrualRecord): PayoutAccrualDocument {
  return {
    _id: row.id,
    idempotencyKey: accrualKeyOf(row),
    creatorId: row.creatorId,
    username: row.username ?? undefined,
    componentSlug: row.componentSlug ?? undefined,
    amountMinor: readAmountColumn(row.amountMinor, `accrual ${row.id}`),
    currency: "USDC",
    reason: row.reason as AccrualReason,
    source: row.source,
    sourceId: row.sourceId,
    occurredAt: row.occurredAt,
    status: row.status as AccrualStatus,
    batchId: row.batchId ?? null,
    note: row.note ?? undefined,
    createdAt: row.createdAt,
  };
}

/**
 * An amount read off a text column.
 *
 * The column is text because the arithmetic is on bigints, so the database
 * hands the exact decimal string back and this is where that string becomes a
 * bigint again. A string that is not an integer is a corrupt row rather than a
 * number to be repaired, and the failure is loud for the same reason the
 * Mongo reader was: a balance that cannot be read exactly is a balance we
 * cannot pay from.
 */
function readAmountColumn(raw: unknown, label: string): Amount {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      throw new AmountError(`${label} is not a stored integer`, 500);
    }
    return BigInt(trimmed);
  }
  return readStoredAmount(raw, label);
}

/**
 * A timestamp read off an aggregate.
 *
 * A column comes back as a `Date`, because the driver knows what a timestamp
 * is. An aggregate is not a column — `max(occurred_at)` is an expression, and
 * an expression arrives without a type — so the database is asked for the
 * epoch millisecond instead and the date is rebuilt here. Letting the database
 * do the conversion is the point: it is the only place that knows what a
 * timestamp means.
 */
function readTimestamp(raw: unknown, label: string): Date | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) return new Date(raw);

  if (typeof raw === "string") {
    const millis = Number(raw.trim());
    if (!Number.isFinite(millis)) {
      throw new Error(`${label} is not a readable timestamp`);
    }
    return new Date(millis);
  }

  throw new Error(`${label} is not a readable timestamp`);
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
 * row, paid twice, which is the whole failure this endpoint exists to make
 * impossible.
 */
export async function listUnpaidAccruals(options: {
  periodStart: Date;
  periodEnd: Date;
  /** Ceiling so a corrupt date range cannot pull the entire ledger into memory. */
  limit?: number;
}): Promise<UnpaidAccrual[]> {
  const client = db();
  await ensurePayoutIndexes();

  const limit = Math.min(Math.max(options.limit ?? 10_000, 1), 50_000);

  const rows = await client
    .select()
    .from(payoutAccruals)
    .where(
      and(
        isNull(payoutAccruals.batchId),
        eq(payoutAccruals.status, "accrued"),
        gte(payoutAccruals.occurredAt, options.periodStart),
        lt(payoutAccruals.occurredAt, options.periodEnd),
      ),
    )
    .orderBy(asc(payoutAccruals.occurredAt), asc(payoutAccruals.id))
    .limit(limit);

  return rows.map((row) => {
    const amountMinor = readAmountColumn(row.amountMinor, `accrual ${row.id}`);
    return {
      id: row.id,
      creatorId: row.creatorId,
      amountMinor,
      occurredAt: row.occurredAt,
      signed: amountMinor < BigInt(0),
    };
  });
}

/** Where each creator in a batch would be paid. */
export async function listPayoutTargets(
  creatorIds: readonly string[],
): Promise<CreatorPayoutTarget[]> {
  if (!creatorIds.length) return [];

  const client = db();
  await ensurePayoutIndexes();

  const rows = await client
    .select()
    .from(payoutAccounts)
    .where(inArray(payoutAccounts.creatorId, [...creatorIds]));

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
 * The sums happen in the database as `bigint` and come back as the exact
 * decimal string they were written as, which is then read with
 * `readAmountColumn`. That reader throws rather than accepting a lossy double.
 * A balance that cannot be read exactly is a balance we cannot pay from.
 */
export async function getCreatorBalance(creatorId: string): Promise<CreatorBalance> {
  const client = db();
  await ensurePayoutIndexes();

  const [accrualRow, batchRow, accountRow] = await Promise.all([
    client
      .select({
        gross: sql<string>`coalesce(sum(${payoutAccruals.amountMinor}::bigint), 0)::text`,
        pending: sql<string>`coalesce(sum(case when ${payoutAccruals.batchId} is null then ${payoutAccruals.amountMinor}::bigint else 0 end), 0)::text`,
        count: sql<number>`(count(*) filter (where ${payoutAccruals.status} <> 'void'))::int`,
        last: sql<string>`(floor(extract(epoch from max(${payoutAccruals.occurredAt})) * 1000))::bigint::text`,
      })
      .from(payoutAccruals)
      .where(eq(payoutAccruals.creatorId, creatorId)),
    client
      .select({
        settled: sql<string>`coalesce(sum(case when ${payoutBatches.status} = 'confirmed' then ${payoutBatches.totalMinor}::bigint else 0 end), 0)::text`,
        inFlight: sql<string>`coalesce(sum(case when ${payoutBatches.status} in ('planned', 'signed', 'submitted') then ${payoutBatches.totalMinor}::bigint else 0 end), 0)::text`,
      })
      .from(payoutBatches)
      .where(eq(payoutBatches.creatorId, creatorId)),
    client
      .select()
      .from(payoutAccounts)
      .where(eq(payoutAccounts.creatorId, creatorId))
      .limit(1),
  ]);

  const grossAccruedMinor = readAmountColumn(accrualRow[0]?.gross ?? "0", "gross accrued");
  const pendingMinor = readAmountColumn(accrualRow[0]?.pending ?? "0", "pending gross");
  const settledMinor = readAmountColumn(batchRow[0]?.settled ?? "0", "settled total");
  const inFlightMinor = readAmountColumn(batchRow[0]?.inFlight ?? "0", "in-flight total");
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
    lastAccrualAt: readTimestamp(accrualRow[0]?.last ?? null, "last accrual"),
    address: accountRow[0]?.address ?? null,
    addressStatus: (accountRow[0]?.status as PayoutAccountStatus | undefined) ?? null,
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
  const client = db();
  await ensurePayoutIndexes();

  const rows = await client
    .select()
    .from(payoutBatches)
    .where(eq(payoutBatches.creatorId, creatorId))
    .orderBy(desc(payoutBatches.createdAt), desc(payoutBatches.id))
    .limit(Math.min(Math.max(limit, 1), 100));

  const eventIds = await eventIdsForBatches(client, rows.map((row) => row.id));

  return rows.map((row) => toBatchDocument(row, eventIds.get(row.id) ?? []));
}

/** A creator's own accrual history, newest first. */
export async function listCreatorAccruals(
  creatorId: string,
  limit = 25,
): Promise<PayoutAccrualDocument[]> {
  const client = db();
  await ensurePayoutIndexes();

  const rows = await client
    .select()
    .from(payoutAccruals)
    .where(eq(payoutAccruals.creatorId, creatorId))
    .orderBy(desc(payoutAccruals.occurredAt), desc(payoutAccruals.id))
    .limit(Math.min(Math.max(limit, 1), 100));

  return rows.map(toAccrualDocument);
}

/** Every batch, for the admin history table. Admin-only callers only. */
export async function listBatches(options: { limit?: number; status?: PayoutBatchStatus } = {}) {
  const client = db();
  await ensurePayoutIndexes();

  const rows = await client
    .select()
    .from(payoutBatches)
    .where(options.status ? eq(payoutBatches.status, options.status) : undefined)
    .orderBy(desc(payoutBatches.createdAt), desc(payoutBatches.id))
    .limit(Math.min(Math.max(options.limit ?? 100, 1), 500));

  const eventIds = await eventIdsForBatches(client, rows.map((row) => row.id));

  return rows.map((row) => toBatchDocument(row, eventIds.get(row.id) ?? []));
}

/**
 * The events each of these batches covers.
 *
 * The batch table has no column for the list of events, but the accrual rows
 * carry the batch that claimed them, so the list is read back from the other
 * side of the same claim. One query for the whole page, not one per row.
 */
async function eventIdsForBatches(
  client: Database,
  batchIds: readonly string[],
): Promise<Map<string, string[]>> {
  const grouped = new Map<string, string[]>();
  if (!batchIds.length) return grouped;

  const rows = await client
    .select({ id: payoutAccruals.id, batchId: payoutAccruals.batchId })
    .from(payoutAccruals)
    .where(inArray(payoutAccruals.batchId, [...batchIds]));

  for (const row of rows) {
    if (!row.batchId) continue;
    const ids = grouped.get(row.batchId) ?? [];
    ids.push(row.id);
    grouped.set(row.batchId, ids);
  }

  return grouped;
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
  const client = db();
  await ensurePayoutIndexes();

  const address = input.address.trim();

  if (!isEvmAddress(address)) {
    throw new PayoutLedgerUnavailableError("a payout address must be a 0x-prefixed 40-digit EVM address");
  }

  const now = new Date();
  const verified = input.status === "verified";

  const rows = await client
    .insert(payoutAccounts)
    .values({
      creatorId: input.creatorId,
      address,
      chain: "base",
      status: input.status,
      requestedAt: now,
      verifiedAt: verified ? now : null,
      verifiedBy: verified ? input.actorId : null,
      createdAt: now,
      updatedAt: now,
    })
    // One address per creator: the creator is the key, so a second write
    // replaces the first. The moment the address was requested is not
    // replaced with it — a creator who asks twice has still asked once.
    .onConflictDoUpdate({
      target: payoutAccounts.creatorId,
      set: {
        address,
        chain: "base",
        status: input.status,
        verifiedAt: verified ? now : null,
        verifiedBy: verified ? input.actorId : null,
        updatedAt: now,
      },
    })
    .returning();

  if (!rows[0]) throw new PayoutLedgerUnavailableError("payout address could not be saved");
  return toAccountDocument(rows[0]);
}

export async function getPayoutAccount(creatorId: string): Promise<PayoutAccountDocument | null> {
  const client = db();
  await ensurePayoutIndexes();

  const rows = await client
    .select()
    .from(payoutAccounts)
    .where(eq(payoutAccounts.creatorId, creatorId))
    .limit(1);

  return rows[0] ? toAccountDocument(rows[0]) : null;
}

/** The row as the document callers expect. */
function toAccountDocument(row: AccountRecord): PayoutAccountDocument {
  return {
    _id: row.creatorId,
    creatorId: row.creatorId,
    address: row.address,
    chain: row.chain as "base",
    status: row.status as PayoutAccountStatus,
    requestedAt: row.requestedAt,
    verifiedAt: row.verifiedAt,
    verifiedBy: row.verifiedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/*                            Settling a batch                                */
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
 * under a batch id that no `payout_batches` row has yet. If the process dies
 * in between, the accruals are marked `scheduled` and point at a batch that
 * does not exist — a state an operator can find and reconcile, and which pays
 * nobody twice. The other order would leave a batch row claiming events that
 * are still unpaid and available to the next run, which pays them twice and
 * leaves the first batch's recipient unpaid.
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
  const client = db();
  await ensurePayoutIndexes();

  const now = new Date();
  const unclaimed: string[] = [];
  let created = 0;
  let duplicates = 0;

  for (const line of input.lines) {
    const eventIds = line.eventIds.filter(isLedgerId);
    const batchId = newLedgerId();

    // `batch_id is null` is the whole concurrency control: two runs computing
    // over the same events both try to claim, and the second one matches
    // nothing because the first already flipped it. The condition and the
    // write are one statement, so a concurrent claimer cannot slip between
    // them.
    const claimed = eventIds.length
      ? await client
          .update(payoutAccruals)
          .set({ batchId, status: "scheduled" })
          .where(
            and(
              inArray(payoutAccruals.id, eventIds),
              isNull(payoutAccruals.batchId),
            ),
          )
          .returning({ id: payoutAccruals.id })
      : [];

    const claimedCount = claimed.length;
    if (claimedCount !== eventIds.length) {
      // Partial claim means somebody else got there first for some of these.
      // Recording which ids failed is the difference between a reconcilable
      // batch and a silent double payment.
      const stillFree = eventIds.length
        ? await client
            .select({ id: payoutAccruals.id })
            .from(payoutAccruals)
            .where(
              and(
                inArray(payoutAccruals.id, eventIds),
                isNull(payoutAccruals.batchId),
              ),
            )
        : [];
      unclaimed.push(...stillFree.map((row) => row.id));
      await releaseClaim(client, batchId);
      continue;
    }

    let rows: { id: string }[];
    try {
      rows = await client
        .insert(payoutBatches)
        .values({
          id: batchId,
          runId: input.runId,
          creatorId: line.creatorId,
          username: line.username ?? null,
          currency: "USDC",
          chain: "base",
          toAddress: line.address,
          totalMinor: line.owedMinor.toString(10),
          grossMinor: line.grossMinor.toString(10),
          roundingRemainder: line.roundingRemainder.toString(10),
          eventCount: eventIds.length,
          status: "planned",
          txHash: null,
          nonce: null,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          createdBy: input.createdBy,
          createdAt: now,
          updatedAt: now,
        })
        // Same run id, same creator, already paid by an earlier attempt. The
        // index refuses the row and the accruals are given back below, so they
        // are not stranded against a batch that will never include them.
        .onConflictDoNothing({
          target: [payoutBatches.runId, payoutBatches.creatorId],
        })
        .returning({ id: payoutBatches.id });
    } catch (error) {
      // The batch was not written, so the events must not stay claimed by it.
      // They go back before the error travels on, because a batch that does
      // not exist is not a thing an operator can reconcile.
      await releaseClaim(client, batchId);
      throw error;
    }

    if (!rows[0]) {
      await releaseClaim(client, batchId);
      duplicates += 1;
      continue;
    }

    created += 1;
  }

  return { runId: input.runId, created, duplicates, unclaimed };
}

/**
 * Give a batch's events back.
 *
 * The claim is released rather than the event removed: the accrual goes back
 * to unpaid with its own status, because it was never paid and the next batch
 * is entitled to see it.
 */
async function releaseClaim(client: Database, batchId: string): Promise<void> {
  await client
    .update(payoutAccruals)
    .set({ batchId: null, status: "accrued" })
    .where(eq(payoutAccruals.batchId, batchId));
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
  const client = db();
  await ensurePayoutIndexes();

  if (!isLedgerId(batchId)) {
    throw new PayoutLedgerUnavailableError("invalid batch id");
  }

  const now = new Date();
  const set: Partial<typeof payoutBatches.$inferInsert> = { updatedAt: now };

  if (patch.status) {
    set.status = patch.status;
    if (patch.status === "signed") set.signedAt = now;
    if (patch.status === "submitted") set.submittedAt = now;
    if (patch.status === "confirmed") set.confirmedAt = now;
  }
  if (patch.txHash !== undefined) set.txHash = patch.txHash;
  if (patch.nonce !== undefined) set.nonce = patch.nonce;
  if (patch.failureReason !== undefined) set.failureReason = patch.failureReason;

  await client.update(payoutBatches).set(set).where(eq(payoutBatches.id, batchId));
}

/** The row as the document callers expect. */
function toBatchDocument(row: BatchRecord, eventIds: string[]): PayoutBatchDocument {
  return {
    _id: row.id,
    runId: row.runId,
    creatorId: row.creatorId,
    username: row.username ?? undefined,
    currency: row.currency as "USDC",
    chain: row.chain as "base",
    toAddress: row.toAddress,
    totalMinor: readAmountColumn(row.totalMinor, `batch ${row.id} total`),
    grossMinor: readAmountColumn(row.grossMinor, `batch ${row.id} gross`),
    roundingRemainder: readAmountColumn(
      row.roundingRemainder,
      `batch ${row.id} rounding remainder`,
    ),
    eventCount: row.eventCount,
    eventIds,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    status: row.status as PayoutBatchStatus,
    txHash: row.txHash,
    nonce: row.nonce,
    signedAt: row.signedAt,
    submittedAt: row.submittedAt,
    confirmedAt: row.confirmedAt,
    failureReason: row.failureReason ?? undefined,
    createdBy: row.createdBy ?? "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/*                              Serialisation                                 */
/* -------------------------------------------------------------------------- */

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
    id: batch._id ?? null,
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
    id: event._id ?? null,
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
