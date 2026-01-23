"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { AdminLayout } from "../components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type AdminUser = {
  _id: string;
  name: string;
  email: string;
  role: "admin";
  createdAt?: string;
  updatedAt?: string;
};

type CreateAdminValues = {
  name: string;
  email: string;
  password: string;
};

type EditAdminValues = {
  name: string;
  email: string;
  password: string;
  currentPassword: string;
};

const MIN_PASSWORD_LENGTH = 12;

export default function AdminSettingsPage() {
  const { data: session } = useSession();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createValues, setCreateValues] = useState<CreateAdminValues>({
    name: "",
    email: "",
    password: "",
  });
  const [createError, setCreateError] = useState("");
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [editValues, setEditValues] = useState<EditAdminValues>({
    name: "",
    email: "",
    password: "",
    currentPassword: "",
  });
  const [editError, setEditError] = useState("");

  const selfId = session?.user?.id || "";

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (!response.ok) {
        throw new Error("Failed to fetch admins");
      }
      const data = await response.json();
      setAdmins(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching admins:", error);
      toast.error("Failed to fetch admins");
    } finally {
      setLoading(false);
    }
  };

  const isEditingSelf = useMemo(
    () => !!editingAdmin && editingAdmin._id === selfId,
    [editingAdmin, selfId],
  );

  const openEdit = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setEditError("");
    setEditValues({
      name: admin.name || "",
      email: admin.email || "",
      password: "",
      currentPassword: "",
    });
  };

  const handleCreateAdmin = async () => {
    setCreateError("");
    if (!createValues.email.trim() || !createValues.password.trim()) {
      setCreateError("Email and password are required.");
      return;
    }
    if (createValues.password.length < MIN_PASSWORD_LENGTH) {
      setCreateError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createValues.name,
          email: createValues.email,
          password: createValues.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData?.error || "Failed to add admin";
        setCreateError(message);
        toast.error(message);
        return;
      }

      const created = await response.json();
      setAdmins((prev) => [created, ...prev]);
      setCreateValues({ name: "", email: "", password: "" });
      toast.success("Admin added");
    } catch (error) {
      console.error("Error creating admin:", error);
      setCreateError("Failed to add admin");
      toast.error("Failed to add admin");
    }
  };

  const handleEditSave = async () => {
    if (!editingAdmin?._id) return;
    setEditError("");

    if (!editValues.name.trim() || !editValues.email.trim()) {
      setEditError("Name and email are required.");
      return;
    }
    if (editValues.password && editValues.password.length < MIN_PASSWORD_LENGTH) {
      setEditError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    const payload: Partial<EditAdminValues> = {
      name: editValues.name.trim(),
      email: editValues.email.trim(),
    };

    if (editValues.password.trim()) {
      payload.password = editValues.password.trim();
    }
    if (isEditingSelf && editValues.currentPassword.trim()) {
      payload.currentPassword = editValues.currentPassword.trim();
    }

    try {
      const response = await fetch(`/api/admin/users/${editingAdmin._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData?.error || "Failed to update admin";
        setEditError(message);
        toast.error(message);
        return;
      }

      const updated = await response.json();
      setAdmins((prev) =>
        prev.map((admin) =>
          admin._id === updated._id ? { ...admin, ...updated } : admin,
        ),
      );
      toast.success("Admin updated");
      setEditingAdmin(null);
    } catch (error) {
      console.error("Error updating admin:", error);
      setEditError("Failed to update admin");
      toast.error("Failed to update admin");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-balance">
            Admin Settings
          </h1>
          <p className="text-muted-foreground text-pretty">
            Manage admin access, credentials, and account security.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-balance">Add admin</h2>
            <p className="text-sm text-muted-foreground text-pretty">
              New admins can sign in immediately after creation.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="admin-name">
                Name
              </label>
              <Input
                id="admin-name"
                value={createValues.name}
                onChange={(e) =>
                  setCreateValues((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Admin name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="admin-email">
                Email
              </label>
              <Input
                id="admin-email"
                type="email"
                value={createValues.email}
                onChange={(e) =>
                  setCreateValues((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                placeholder="admin@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="admin-password">
                Password
              </label>
              <Input
                id="admin-password"
                type="password"
                value={createValues.password}
                onChange={(e) =>
                  setCreateValues((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                placeholder={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
              />
            </div>
          </div>
          {createError ? (
            <p className="text-sm text-destructive" aria-live="polite">
              {createError}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button onClick={handleCreateAdmin}>Add admin</Button>
          </div>
        </div>

        <div className="border rounded-xl bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={`admin-skeleton-${index}`}>
                    <TableCell>
                      <Skeleton className="h-4 w-36" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-8 w-20" />
                    </TableCell>
                  </TableRow>
                ))
              ) : admins.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-10 text-sm text-muted-foreground"
                  >
                    No admins found.
                  </TableCell>
                </TableRow>
              ) : (
                admins.map((admin) => (
                  <TableRow key={admin._id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{admin.name}</span>
                        {admin._id === selfId ? (
                          <Badge variant="secondary">You</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Admin</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-sm text-muted-foreground">
                      {admin.updatedAt
                        ? new Date(admin.updatedAt).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEdit(admin)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={!!editingAdmin}
        onOpenChange={(open) => {
          if (!open) {
            setEditingAdmin(null);
            setEditError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-balance">Edit admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-admin-name">
                Name
              </label>
              <Input
                id="edit-admin-name"
                value={editValues.name}
                onChange={(e) =>
                  setEditValues((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-admin-email">
                Email
              </label>
              <Input
                id="edit-admin-email"
                type="email"
                value={editValues.email}
                onChange={(e) =>
                  setEditValues((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="edit-admin-password"
              >
                New password
              </label>
              <Input
                id="edit-admin-password"
                type="password"
                value={editValues.password}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                placeholder={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
              />
            </div>
            {isEditingSelf ? (
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="edit-admin-current-password"
                >
                  Current password
                </label>
                <Input
                  id="edit-admin-current-password"
                  type="password"
                  value={editValues.currentPassword}
                  onChange={(e) =>
                    setEditValues((prev) => ({
                      ...prev,
                      currentPassword: e.target.value,
                    }))
                  }
                  placeholder="Required to change your own email/password"
                />
              </div>
            ) : null}
            {editError ? (
              <p className="text-sm text-destructive" aria-live="polite">
                {editError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditingAdmin(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
