import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import {
  findAccountByEmail,
  readAccount,
  updateAccount,
} from "@/lib/db/users";

const MIN_PASSWORD_LENGTH = 12;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sanitizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 80);
}

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const body = await request.json();
    const rawEmail = typeof body?.email === "string" ? body.email : undefined;
    const rawName = typeof body?.name === "string" ? body.name : undefined;
    const newPassword =
      typeof body?.password === "string" ? body.password : undefined;
    const currentPassword =
      typeof body?.currentPassword === "string" ? body.currentPassword : "";

    const updates: { email?: string; name?: string; password?: string } = {};
    if (rawEmail !== undefined) {
      const email = normalizeEmail(rawEmail);
      if (!email) {
        return NextResponse.json(
          { error: "Email is required" },
          { status: 400 },
        );
      }
      updates.email = email;
    }

    if (rawName !== undefined) {
      const name = sanitizeName(rawName);
      if (!name) {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 },
        );
      }
      updates.name = name;
    }

    if (newPassword) {
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json(
          {
            error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          },
          { status: 400 },
        );
      }
    }

    const targetUser = await readAccount(id);

    if (!targetUser || targetUser.role !== "admin") {
      return NextResponse.json(
        { error: "Admin user not found" },
        { status: 404 },
      );
    }

    const isSelf = targetUser._id === session.user.id;
    if (isSelf && (newPassword || updates.email)) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required" },
          { status: 400 },
        );
      }
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        (await readAccountWithPassword(id)) ?? "",
      );
      if (!isValidPassword) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 401 },
        );
      }
    }

    if (updates.email && updates.email !== targetUser.email) {
      const existing = await findAccountByEmail(updates.email);
      if (existing) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 },
        );
      }
    }

    if (newPassword) {
      updates.password = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No changes provided" },
        { status: 400 },
      );
    }

    const result = await updateAccount(id, updates);

    if (!result) {
      return NextResponse.json(
        { error: "Admin user not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating admin user:", error);
    return NextResponse.json(
      { error: "Failed to update admin user" },
      { status: 500 },
    );
  }
}

/**
 * The secret, read for one reason only.
 *
 * A password is never in the answer an account read produces — there is no
 * reason for one — but the one place that needs it is the check that asks
 * whether the person making the change knows the current password. So it is
 * read here, and nowhere else.
 */
async function readAccountWithPassword(id: string): Promise<string | null> {
  const { findAccountBySession } = await import("@/lib/db/users");
  const { account } = await findAccountBySession(id);
  if (!account) return null;
  return account.password ?? null;
}
