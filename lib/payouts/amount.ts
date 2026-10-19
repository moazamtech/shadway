/**
 * Money as integers, and only as integers.
 *
 * There is no money handling anywhere else in this repo — `Template.price` is
 * a bare `number` used only to render a card, and nothing sums it. Payouts are
 * the first place where a fractional value would be a defect rather than a
 * cosmetic one, so the rule is set here and this is the only module allowed to
 * turn a number into an amount.
 *
 * ## Why bigint and not `number`
 *
 * A JS `number` is a float64. It represents integers exactly only up to
 * 2^53 - 1, and it has no way to tell you when it has stopped: `2^53 + 1` and
 * `2^53` are the same value. A ledger that silently rounds a balance upward by
 * one unit is not a bug anyone ever notices, because the ledger still balances
 * against itself.
 *
 * The second failure is at the storage layer, and it arrives earlier than the
 * precision ceiling does. The BSON encoder writes an integer-valued `number`
 * below 2^31 as Int32 and everything above it as **double** — verified, not
 * assumed: `BSON.serialize({ a: 3000000000 })[0] === 0x01`. So 3,000.000000 USDC
 * (three thousand dollars) would be stored as a float64, and a `$sum` over such
 * fields can come back non-integral. Money that is a float in the database is
 * money you cannot reconcile. `bigint` is written as Int64 (type byte `0x12`)
 * and has no precision ceiling inside the 64-bit range, so the type in this
 * module is also the type in the document.
 *
 * ## Why amounts cross the API as strings
 *
 * JSON has no integer type, and `JSON.parse` turns a 19-digit number into a
 * lossy double — the same bug, one layer out. It also throws outright on a
 * bigint (`TypeError: Do not know how to serialize a BigInt`), which is a
 * convenient tripwire but a poor error message at 2am. So the wire format is a
 * decimal string, parsed back through `parseAmount`, which rejects anything
 * that is not an exact integer. A float arriving from a client is a 400, not a
 * silently accepted 19.999999999.
 *
 * ## The rounding rule, in one place
 *
 * Where a share is computed from a rate, division **truncates toward zero** —
 * the platform never rounds a creator *up*, and a clawback never rounds a
 * creator's deduction up either. The exact residue is never discarded: it is
 * returned as `remainder` in units of 1/10000 of a minor unit and accounted for
 * explicitly. See `applyBps`.
 *
 * `applyBps` is deliberately called once per creator per payment and not once
 * per accrual — see `lib/payouts/payouts.ts`, which is where that decision is
 * argued.
 */

/**
 * USDC has six decimals, and so does the ERC-20 token on Base. One minor unit
 * is 1e-6 USDC.
 */
export const USDC_DECIMALS = 6;

/** Minor units in one USDC. `BigInt(1_000_000)`, not `1000000n`: see the note on literals below. */
export const USDC_SCALE: bigint = BigInt(1_000_000);

/** Basis points are hundredths of a percent: 1 bps = 0.01%, 10_000 bps = 100%. */
export const BPS_SCALE: bigint = BigInt(10_000);

/**
 * A quantity of USDC in minor units.
 *
 * Named rather than inlined so a function signature says "this is money" and a
 * reviewer does not have to infer it from a parameter called `n`.
 */
export type Amount = bigint;

/**
 * Note on `BigInt(1)` vs `1n` throughout this file: `tsconfig.json` targets
 * ES2017, and TypeScript rejects bigint *literals* below ES2020 even though
 * the `bigint` type itself is fine. The call form compiles, reads almost as
 * well, and costs nothing at runtime.
 */

/**
 * A rejected amount. A distinct type so callers can tell "the client sent
 * nonsense" (a 400, not a bug) from "the ledger is corrupt" (a 500).
 */
export class AmountError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AmountError";
    this.status = status;
  }
}

const MAX_BPS = 10_000;

/**
 * Coerce something already known to be integral into an `Amount`.
 *
 * Deliberately total: no clamping, no rounding, no "probably fine". A function
 * that quietly repaired a bad amount would move the point at which the ledger
 * stops agreeing with itself somewhere nobody is looking.
 */
export function assertAmount(value: unknown, label = "amount"): Amount {
  if (typeof value === "bigint") return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new AmountError(`${label} must be a finite number`);
    }
    if (!Number.isSafeInteger(value)) {
      // The ceiling, not the value, is the problem: at 2^53 the float can no
      // longer represent consecutive integers, so the number is already wrong
      // before any business rule is applied.
      throw new AmountError(
        `${label} is outside the exactly-representable integer range; pass it as a decimal string instead`,
      );
    }
    return BigInt(value);
  }

  throw new AmountError(`${label} must be an integer`);
}

/**
 * Read an amount off the wire.
 *
 * Accepts a decimal string (canonical) or a safe integer. Rejects floats
 * outright, including `1.0`, because a client that sends `1.0` is a client
 * whose arithmetic is already float-based and its intent is not trustworthy
 * down to the minor unit.
 */
export function parseAmount(raw: unknown, label = "amount"): Amount {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    // Anchored and character-classed, so "1e6", "0x10", "1.0", "1,000" and
    // " 1 2" are all rejected rather than coerced by Number() into something
    // that looks like an amount.
    if (!/^-?\d+$/.test(trimmed)) {
      throw new AmountError(`${label} must be an integer number of minor units`);
    }
    return assertAmount(BigInt(trimmed), label);
  }

  return assertAmount(raw, label);
}

/**
 * The canonical serialised form of an amount: a base-10 integer string.
 *
 * Every response body in this subsystem runs amounts through here. It is not
 * cosmetic — `JSON.stringify` throws on a bigint, and a route that throws while
 * serialising a *successful* balance returns a 500 and reads to the user as
 * "your money is broken".
 */
export function toAmountString(amount: Amount): string {
  return amount.toString(10);
}

/**
 * Read an amount out of MongoDB.
 *
 * The driver returns an Int64 as a JS `number` when it fits the safe-integer
 * range and as a `Long` when it does not, so both shapes have to be handled —
 * and the number shape has to be *checked*, because a value that arrived as a
 * lossy double is indistinguishable from a correct one once it is a plain
 * number. Throwing here is the only honest option: the alternative is a balance
 * that is wrong by an unknown amount and reports itself as exact.
 */
export function readStoredAmount(raw: unknown, label = "stored amount"): Amount {
  if (raw === null || raw === undefined) {
    // A missing amount is a schema violation, not zero. Reading it as zero
    // would let a half-written document quietly under-pay somebody forever.
    throw new AmountError(`${label} is missing`, 500);
  }

  if (typeof raw === "bigint") return raw;

  if (typeof raw === "number") return assertAmount(raw, label);

  // bson `Long` (and any object exposing `toBigInt`, which keeps this working
  // if the shape ever moves to Decimal128).
  if (typeof raw === "object" && typeof (raw as { toBigInt?: unknown }).toBigInt === "function") {
    try {
      return (raw as { toBigInt(): bigint }).toBigInt();
    } catch (error) {
      throw new AmountError(
        `${label} could not be read as an integer (${error instanceof Error ? error.message : "unknown"})`,
        500,
      );
    }
  }

  throw new AmountError(`${label} is not a stored integer`, 500);
}

/** Add amounts. Present so callers never write `a + b` where `a`/`b` are optional. */
export function sumAmounts(values: readonly Amount[]): Amount {
  let total = BigInt(0);
  for (const value of values) total += assertAmount(value);
  return total;
}

/**
 * A share of an amount at a basis-point rate, plus the exact residue.
 *
 * `bps` is in basis points: 7000 is 70%. The division truncates toward zero,
 * so the platform never rounds a creator up, and the returned `remainder` is
 * the exact residue in units of 1/10000 of a minor unit — strictly between 0
 * and 9_999 inclusive, and carrying the sign of the input.
 *
 * The remainder is returned rather than discarded so the caller can decide
 * where it goes, out loud. Silently truncating here is how a ledger starts
 * disagreeing with the sum of its own rows by a fraction of a cent that nobody
 * can explain six months later.
 */
export function applyBps(
  gross: Amount,
  bps: number,
): { amount: Amount; remainder: bigint } {
  if (!Number.isInteger(bps) || bps < 0 || bps > MAX_BPS) {
    throw new AmountError(`rate must be a whole number of basis points in 0..${MAX_BPS}`, 500);
  }

  const base = assertAmount(gross, "gross");
  if (base === BigInt(0)) return { amount: BigInt(0), remainder: BigInt(0) };

  const product = base * BigInt(bps);
  // BigInt division truncates toward zero. That is the rounding rule: not
  // `Math.round`, not "round half to even", not "round half up". Toward zero is
  // the only choice that cannot increase what the platform owes in either
  // direction.
  const amount = product / BPS_SCALE;
  return { amount, remainder: product - amount * BPS_SCALE };
}

/**
 * Render an amount for a human, at a chosen number of decimal places.
 *
 * Display only. The digits past `decimals` are rounded half-up, and the result
 * is a string — it is never fed back into arithmetic. A balance tile that shows
 * $5.00 is not a statement that 5.000000 was paid; the ledger is.
 */
export function formatUsdc(amount: Amount, decimals: number = USDC_DECIMALS): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > USDC_DECIMALS) {
    throw new AmountError(`decimals must be a whole number in 0..${USDC_DECIMALS}`, 500);
  }

  const value = assertAmount(amount);
  const negative = value < BigInt(0);
  const magnitude = (negative ? -value : value).toString(10).padStart(USDC_DECIMALS + 1, "0");
  const whole = magnitude.slice(0, magnitude.length - USDC_DECIMALS);
  const fraction = magnitude.slice(magnitude.length - USDC_DECIMALS);

  // Half-up on the digit being dropped. Purely cosmetic, and only ever reached
  // for digits below `decimals` — the digits above are exact.
  let shown = fraction.slice(0, decimals);
  if (decimals < USDC_DECIMALS) {
    const next = Number(fraction.charAt(decimals));
    if (next >= 5) {
      const bumped = (Number(shown.padEnd(decimals, "0")) + 1).toString().padStart(decimals, "0");
      shown = bumped.length > decimals ? "0".repeat(decimals + 1) : bumped;
    }
  }

  const body = decimals > 0 ? `${whole}.${shown}` : whole;
  return `${negative ? "-" : ""}$${body}`;
}

/**
 * Shorten an address for a table cell: `0x1234…abcd`.
 *
 * Payout addresses are public — they are on a public chain — but a table of
 * full-width hashes pushes the amount column off screen on a laptop.
 */
export function shortenAddress(address: string): string {
  if (!address.startsWith("0x") || address.length !== 42) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
