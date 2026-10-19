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
