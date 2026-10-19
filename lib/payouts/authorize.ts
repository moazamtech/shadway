import type { Session } from "next-auth";
import { isAdmin } from "@/lib/session";

/**
 * Who may do what in the payout subsystem.
 *
 * Every decision in this file is a pure function of the session, and every
 * route in `app/api/payouts/` starts by calling one of them. There is no
 * second admin check anywhere: `isAdmin` from `@/lib/session` is the same
 * predicate `proxy.ts` uses to gate `/admin/**` and the same one
 * `app/api/admin/*` uses, so an account that can reach the admin dashboard can
 * reach this and an account that cannot cannot.
 *
 * ## No `next/server` in here, on purpose
 *
 * The decisions return `{ status, error }` rather than a `NextResponse`. That
 * keeps this module free of the framework so it can be exercised directly — the
 * negative cases in `__tests__/authorisation.test.ts` call these functions and
 * call the route handlers, and neither needs a rendered Next runtime to prove
 * that a signed-in stranger is refused someone else's ledger.
 *
 * A denied request says the same thing whether the caller is anonymous (401) or
 * signed in without the right (403). Splitting them is not secrecy — the status
 * is already visible — it is the difference between "sign in and try again" and
 * "you are signed in and this will never work for you", which is the difference
 * between a user fixing the problem and a user filing a ticket.
 */

/** A refused request: what to send back, and why. */
export type PayoutDenial = {
  ok: false;
  status: 401 | 403;
  error: string;
};

export type PayoutGrant = {
  ok: true;
  /** The session's account id. Always the caller's own, never a request field. */
  userId: string;
};

export type PayoutDecision = PayoutDenial | PayoutGrant;

/** A session is only usable if it carries an account id. */
function sessionUserId(session: Session | null | undefined): string | null {
  const id = session?.user?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * A signed-in account reading or writing its own ledger.
 *
 * Takes no `userId`. That is the whole design: the subject of a self-service
 * payout request is the session, so there is no parameter for a bug, a
 * copy-paste, or a curious client to get wrong. `resolveLedgerSubject` below is
 * the only place a different id may enter the system, and it decides for the
 * caller.
 */
export function requirePayoutSelf(session: Session | null | undefined): PayoutDecision {
  const userId = sessionUserId(session);
  if (!userId) {
    return { ok: false, status: 401, error: "Sign in to see your earnings" };
  }
  return { ok: true, userId };
}

/**
 * Running a batch, recording an accrual, or reading the whole payout table.
 *
 * Admin only, and admin means exactly what it means everywhere else in this
 * repo. Note what this guard is *not* asked to prove: it does not check that
 * the caller owns the components being paid, because an admin legitimately does
 * not. That is also why an admin acting here is an audit event — `createdBy`
 * and `recordedBy` record the session id on every row, so "who moved this
 * money" is answerable from the ledger rather than from a log that rotates.
 */
export function requirePayoutAdmin(session: Session | null | undefined): PayoutDecision {
  const userId = sessionUserId(session);
  if (!userId) {
    return { ok: false, status: 401, error: "Sign in to manage payouts" };
  }
  if (!isAdmin(session)) {
    return { ok: false, status: 403, error: "Not permitted" };
  }
  return { ok: true, userId };
}

export type LedgerSubject = PayoutGrant & {
  /** True when the caller asked for somebody else and was quietly given themselves. */
  selfOnly: boolean;
};

/**
 * Work out whose ledger a read is allowed to touch.
 *
 * `requestedUserId` is whatever the client sent — a path segment or a query
 * string, which is to say attacker-controlled. An admin asking for another
 * creator gets that creator. Everybody else gets themselves, *even when they
 * ask for somebody else*: collapsing the request to the caller's own id rather
 * than rejecting it means a stale link on a page somewhere shows the reader
 * their own balance instead of a 403 they will report as a bug, and there is no
 * path through this function by which a non-admin's response contains another
 * creator's amounts.
 *
 * The alternative — refusing — was rejected deliberately: it makes a
 * self-service surface fail closed in a way that is indistinguishable, to the
 * person using it, from the site being broken.
 */
export function resolveLedgerSubject(
  session: Session | null | undefined,
  requestedUserId?: string | null,
): LedgerSubject | PayoutDenial {
  const self = requirePayoutSelf(session);
  if (!self.ok) return self;

  const requested = typeof requestedUserId === "string" ? requestedUserId.trim() : "";
  if (!requested || requested === self.userId) {
    return { ok: true, userId: self.userId, selfOnly: true };
  }

  if (isAdmin(session)) {
    return { ok: true, userId: requested, selfOnly: false };
  }

  return { ok: true, userId: self.userId, selfOnly: true };
}

/**
 * Whether an address change may be applied to `creatorId`.
 *
 * The asymmetry is deliberate: a creator may set their own (it goes to
 * `pending`, and nothing pays a pending address), an admin may set anybody's.
 * The reverse — an admin acting on somebody else without being an admin — is
 * the case that would let an account-takeover redirect a payout rail, so it is
 * refused rather than treated as a no-op.
 */
export function requireAddressWrite(
  session: Session | null | undefined,
  creatorId: string,
): PayoutDecision {
  const self = requirePayoutSelf(session);
  if (!self.ok) return self;
  if (self.userId === creatorId) return { ok: true, userId: self.userId };
  if (isAdmin(session)) return { ok: true, userId: self.userId };
  return { ok: false, status: 403, error: "Not permitted" };
}
