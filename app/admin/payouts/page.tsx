"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, ShieldCheck, Wallet, X } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "../components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { shortenAddress } from "@/lib/payouts/amount";

/**
 * Payout address verification.
 *
 * An address is the only thing that decides where USDC goes, and a session
 * cookie is enough for a creator to change it. This page is the second
 * signature: an admin looks at the address and approves *that exact value*.
 * The API refuses the call if the value changed in between, so a stale tab
 * cannot approve an address nobody read.
 */

type Status = "pending" | "verified" | "rejected";

type Account = {
  creatorId: string;
  creator: string | null;
  address: string;
  chain: "base";
  status: Status;
  requestedAt: string | null;
  verifiedAt: string | null;
  updatedAt: string | null;
};

/** What the weekly run would do, in the shape the route answers with. */
type RunPlan = {
  written?: boolean;
  batches?: number;
  runId?: string;
  plan?: {
    lines?: {
      creatorId: string;
      address: string;
      grossMinor: string;
      owedMinor: string;
      eventCount: number;
    }[];
    skipped?: {
      creatorId: string;
      reason: string;
      grossMinor: string;
      owedMinor: string;
      shortfallMinor: string;
      eventCount: number;
    }[];
    totals?: {
      grossMinor: string;
      owedMinor: string;
      creatorsPaid: number;
      creatorsSkipped: number;
    };
  };
};

/** Minor units as dollars, for the eye rather than for arithmetic. */
function usdc(minor: string): string {
  try {
    const value = BigInt(minor);
    const whole = value / BigInt(1_000_000);
    const cents = (value % BigInt(1_000_000)) / BigInt(10_000);
    return `$${whole}.${cents.toString().padStart(2, "0")}`;
  } catch {
    return "$0.00";
  }
}

const TONE: Record<Status, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-transparent",
  verified: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent",
  rejected: "bg-destructive/10 text-destructive border-transparent",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function PayoutsPage() {
  const [items, setItems] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Account | null>(null);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<RunPlan | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/payout-accounts", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load payout accounts");
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) toast.error("Failed to load payout accounts");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const pending = useMemo(() => items.filter((item) => item.status === "pending").length, [items]);

  /**
   * The weekly run.
   *
   * The plan is read before it is written, because the two are the same
   * arithmetic and an operator who cannot see the numbers should not be
   * writing them. Writing the batch records what would be paid and claims the
   * earnings it covers; it does not move money — that is the step the signing
   * key owns, and the key is not in this application.
   */
  async function runBatch(confirm: boolean) {
    setRunning(true);
    try {
      const response = await fetch("/api/admin/payouts/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "The run failed");
      }
      setRun(data);
      toast.success(
        confirm
          ? `Batch written${data.batches ? `: ${data.batches} creator(s)` : ""}.`
          : "Preview ready.",
      );
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "The run failed");
    } finally {
      setRunning(false);
    }
  }

  async function decide(account: Account, action: "verify" | "reject") {
    setBusy(account.creatorId);
    try {
      const response = await fetch("/api/admin/payout-accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: account.creatorId,
          address: account.address,
          action,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Action failed");

      setItems((current) =>
        current.map((row) =>
          row.creatorId === account.creatorId
            ? { ...row, status: action === "verify" ? "verified" : "rejected" }
            : row
        )
      );
      toast.success(action === "verify" ? "Address verified" : "Address rejected");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        {/* The weekly run. */}
        <section className="rounded-md border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Weekly run</h2>
              <p className="text-xs text-muted-foreground">
                The last seven days of earnings, and what would be paid from
                them. Writing the batch records the decision and claims the
                earnings it covers; the transaction itself is signed with the
                key this deployment does not hold.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={running}
                onClick={() => void runBatch(false)}
              >
                {running ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Preview
              </Button>
              <Button size="sm" disabled={running} onClick={() => void runBatch(true)}>
                {running ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                Write the batch
              </Button>
            </div>
          </div>

          {run?.plan ? (
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>
                  Paying {run.plan.totals?.creatorsPaid ?? 0} creator
                  {run.plan.totals?.creatorsPaid === 1 ? "" : "s"} ·{" "}
                  {usdc(run.plan.totals?.owedMinor ?? "0")}
                </span>
                <span>
                  Skipping {run.plan.totals?.creatorsSkipped ?? 0} ·{" "}
                  {usdc(run.plan.totals?.grossMinor ?? "0")} accrued
                </span>
                {run.written ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Batch written{run.batches ? `: ${run.batches}` : ""} — awaiting
                    a signature.
                  </span>
                ) : null}
              </div>

              {run.plan.lines?.length ? (
                <ul className="divide-y divide-border rounded-md border">
                  {run.plan.lines.map((line) => (
                    <li key={line.creatorId} className="flex items-center gap-3 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">
                        {line.address}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {line.eventCount} event{line.eventCount === 1 ? "" : "s"}
                      </span>
                      <span className="font-medium tabular-nums">
                        {usdc(line.owedMinor)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {run.plan.skipped?.length ? (
                <ul className="divide-y divide-border rounded-md border">
                  {run.plan.skipped.map((line) => (
                    <li key={line.creatorId} className="flex items-center gap-3 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                        {line.creatorId}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {line.reason.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {usdc(line.owedMinor)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payout addresses</h1>
            <p className="text-muted-foreground">
              Verify the Base address each creator is paid at. An address is never paid before
              it is approved here.
            </p>
          </div>
          <Badge variant="secondary" className="gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            {loading ? "…" : `${pending} pending`}
          </Badge>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Creator</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={5} className="py-8">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Wallet className="mx-auto mb-2 h-5 w-5" />
                    No creator has requested a payout address yet.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((account) => (
                  <TableRow key={account.creatorId}>
                    <TableCell>
                      <div className="truncate text-sm font-medium">
                        {account.creator ?? account.creatorId}
                      </div>
                      <div className="truncate font-mono text-[11px] text-muted-foreground">
                        {account.creatorId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs" title={account.address}>
                        {shortenAddress(account.address)}
                      </span>
                      <div className="text-[11px] text-muted-foreground">{account.chain}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(account.requestedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge className={TONE[account.status]} variant="outline">
                        {account.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === account.creatorId || account.status === "verified"}
                          onClick={() => void decide(account, "verify")}
                        >
                          {busy === account.creatorId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1">Verify</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy === account.creatorId || account.status === "rejected"}
                          onClick={() => setRejectTarget(account)}
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="ml-1">Reject</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this payout address?</AlertDialogTitle>
            <AlertDialogDescription>
              {rejectTarget ? (
                <>
                  <span className="font-mono text-xs">{rejectTarget.address}</span> will not be
                  paid. The creator keeps their balance and can submit a different address.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (rejectTarget) void decide(rejectTarget, "reject");
                setRejectTarget(null);
              }}
            >
              Reject address
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
