"use client";

import { useEffect, useState } from "react";
export const MIN_PASSWORD_LENGTH = 8;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Me = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string | null;
};

export function AccountForm({
  initialName,
  email,
}: {
  initialName: string;
  email?: string | null;
}) {
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "success"; message: string } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.item) return;
        setMe(data.item);
        setName(data.item.name ?? "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      setStatus({ kind: "error", message: "New passwords do not match." });
      return;
    }
    setLoading(true);
    setStatus({ kind: "idle" });
    try {
      const body: Record<string, string> = {};
      if (name.trim() && name.trim() !== (me?.name ?? "").trim()) {
        body.name = name.trim();
      }
      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }
      if (!Object.keys(body).length) {
        setStatus({ kind: "error", message: "No changes detected." });
        setLoading(false);
        return;
      }
      const res = await fetch("/api/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({
          kind: "error",
          message: data?.error || "Failed to update account.",
        });
        setLoading(false);
        return;
      }
      setStatus({ kind: "success", message: "Account updated." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      // Refresh the cached profile.
      fetch("/api/me", { credentials: "include", cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.item) {
            setMe(d.item);
            setName(d.item.name ?? "");
          }
        })
        .catch(() => {});
    } catch {
      setStatus({ kind: "error", message: "Network error. Try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {status.kind === "success" ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-600">
          {status.message}
        </div>
      ) : null}
      {status.kind === "error" ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {status.message}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="settings-name">Display name</Label>
        <Input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="settings-email">Email</Label>
        <Input id="settings-email" value={email ?? me?.email ?? ""} disabled />
        <p className="text-xs text-muted-foreground">
          Email changes are not supported from here yet.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-border/70 p-4">
        <h2 className="text-sm font-semibold">Change password</h2>
        <div className="space-y-2">
          <Label htmlFor="settings-current">Current password</Label>
          <Input
            id="settings-current"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-new">New password</Label>
          <Input
            id="settings-new"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-confirm">Confirm new password</Label>
          <Input
            id="settings-confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Leave the password fields empty to keep your current password.
        </p>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
