"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Check,
  CircleDollarSign,
  Clock,
  Loader2,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatUsdc, shortenAddress } from "@/lib/payouts/amount";
import { MIN_PAYOUT_MINOR, REVENUE_SHARE_BPS } from "@/lib/payouts/payouts";

/**
 * The creator's side of the payout rail.
 *
 * Everything here is read from `/api/payouts`, which derives the creator id
 * from the session — this component never names one. The address form is a
 * *request*: an address is stored as `pending` and only paid once a human has
 * verified it, so the copy says that rather than implying a save is a payout.
 */

type BatchStatus = "planned" | "signed" | "submitted" | "confirmed" | "failed";
type AccountStatus = "pending" | "verified" | "rejected";

type Batch = {
  id: string | null;
  totalMinor: string;
  status: BatchStatus;
  txHash: string | null;
  createdAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  failureReason: string | null;
};

type Payload = {
  balance: {
    pendingMinor: string;
    estimatedOwedMinor: string;
    settledMinor: string;
    grossAccruedMinor: string;
    inFlightMinor: string;
    readyToPay: boolean;
    accrualCount: number;
    lastAccrualAt: string | null;
    address: string | null;
    addressStatus: AccountStatus | null;
  };
  batches: Batch[];
};

const SHARE_PERCENT = Math.round(REVENUE_SHARE_BPS / 100);
const MINIMUM = formatUsdc(MIN_PAYOUT_MINOR, 2);

const BATCH_LABEL: Record<BatchStatus, string> = {
  planned: "Scheduled",
  signed: "Signing",
  submitted: "Sent",
  confirmed: "Paid",
  failed: "Failed",
};

const BATCH_TONE: Record<BatchStatus, string> = {
  planned: "bg-muted text-muted-foreground",
  signed: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  submitted: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  confirmed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  failed: "bg-destructive/10 text-destructive",
};

const ACCOUNT_LABEL: Record<AccountStatus, string> = {
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected — submit a different address",
};

const ACCOUNT_TONE: Record<AccountStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  verified: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejected: "bg-destructive/10 text-destructive",
};

function shortDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function usdc(minor: string, decimals = 2): string {
  try {
    return formatUsdc(BigInt(minor), decimals);
  } catch {
    return "$0.00";
  }
}

export function PayoutsPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/payouts", { credentials: "include", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((payload: Payload) => {
        if (cancelled) return;
        setData(payload);
        setAddress(payload.balance.address ?? "");
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const paid = useMemo(() => {
    const confirmed = (data?.batches ?? []).filter((batch) => batch.status === "confirmed");
    const total = confirmed.reduce((sum, batch) => {
      try {
        return sum + BigInt(batch.totalMinor);
      } catch {
        return sum;
      }
    }, BigInt(0));
    return { label: formatUsdc(total, 2), count: confirmed.length };
  }, [data]);

  async function saveAddress(event: FormEvent) {
    event.preventDefault();
    const next = address.trim();
    if (!next || saving) return;

    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch("/api/payouts/address", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: next }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        item?: { address: string; status: AccountStatus };
        error?: string;
      };

      if (!response.ok || !payload.item) {
        setNotice({
          kind: "error",
          message: payload.error ?? "That address could not be saved.",
        });
        return;
      }

      setData((current) =>
        current
          ? {
              ...current,
              balance: {
                ...current.balance,
                address: payload.item!.address,
                addressStatus: payload.item!.status,
              },
            }
          : current
      );
      setAddress(payload.item.address);
      setNotice({
        kind: "ok",
        message:
          payload.item.status === "verified"
            ? "That address is already verified."
            : "Saved. New addresses are verified before the next payout run.",
      });
    } catch {
      setNotice({ kind: "error", message: "Network error — the address was not saved." });
    } finally {
      setSaving(false);
    }
  }

  const status = data?.balance.addressStatus ?? null;

  return (
    <section aria-labelledby="payouts-heading" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="payouts-heading" className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Payouts
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            You keep {SHARE_PERCENT}% of install revenue. Earnings accrue in USDC and are paid
            weekly on Base, once the unpaid balance clears {MINIMUM}.
          </p>
        </div>
        <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
          USDC · Base
        </span>
      </div>

      {failed ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          <p>The payout ledger could not be read just now.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => window.location.reload()}
          >
            Try again
          </Button>
        </div>
      ) : !data ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading earnings…
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Unpaid"
              value={usdc(data.balance.pendingMinor)}
              hint={
                data.balance.accrualCount === 0
                  ? "No earnings yet"
                  : `${data.balance.accrualCount} event${data.balance.accrualCount === 1 ? "" : "s"}`
              }
            />
            <Stat
              label="Your share"
              value={usdc(data.balance.estimatedOwedMinor)}
              hint={data.balance.readyToPay ? "Clears the minimum" : `Below ${MINIMUM}`}
              tone={data.balance.readyToPay ? "ready" : undefined}
            />
            <Stat
              label="Paid out"
              value={paid.label}
              hint={`${paid.count} payout${paid.count === 1 ? "" : "s"}`}
            />
          </div>

          <form onSubmit={saveAddress} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="payout-address" className="text-sm">
                Payout address
              </Label>
              {status ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    ACCOUNT_TONE[status]
                  )}
                >
                  {ACCOUNT_LABEL[status]}
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Not set
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="payout-address"
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value);
                  setNotice(null);
                }}
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                className="font-mono text-sm"
                aria-describedby="payout-address-hint"
              />
              <Button type="submit" disabled={saving || !address.trim()} className="sm:w-28">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>

            <p id="payout-address-hint" className="text-xs text-muted-foreground">
              A 0x address on Base. It is checked before the first payout, and changing it
              sends a new address back through review.
            </p>

            {notice ? (
              <p
                role="status"
                className={cn(
                  "flex items-start gap-1.5 text-xs",
                  notice.kind === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                )}
              >
                {notice.kind === "ok" ? (
                  <Check className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : null}
                {notice.message}
              </p>
            ) : null}
          </form>

          <div>
            <h3 className="text-sm font-medium">Recent payouts</h3>
            {data.batches.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                No payouts yet. The first one is scheduled after your unpaid balance clears{" "}
                {MINIMUM} and your address is verified.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                {data.batches.map((batch) => (
                  <li
                    key={batch.id ?? `${batch.createdAt}-${batch.totalMinor}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{usdc(batch.totalMinor)}</p>
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {shortDate(batch.periodStart ?? batch.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          BATCH_TONE[batch.status]
                        )}
                      >
                        {BATCH_LABEL[batch.status]}
                      </span>
                      {batch.txHash ? (
                        <a
                          href={`https://basescan.org/tx/${batch.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          {shortenAddress(batch.txHash)}
                          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "ready";
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p
        className={cn(
          "mt-0.5 text-[11px]",
          tone === "ready" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
        )}
      >
        {hint}
      </p>
    </div>
  );
}
