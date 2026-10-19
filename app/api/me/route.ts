import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findAccountBySession as findAccount } from "@/lib/db/users";

const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 80;

function sanitizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
}

/**
 * Self-service account endpoint.
 *
 * GET   -> the signed-in user's profile (never the password hash).
 * PATCH -> update name and/or password. A password change must present the
 *          current one, and the new one must meet the minimum length.
 *
 * The account lookup (by `_id`, falling back to the email for sessions minted
 * before the id was carried on the token) lives in `lib/db/users` now, so
 * `/api/profile` resolves the caller exactly the same way.
 */

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { account } = await findAccount(session.user.id, session.user.email);
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json({
      item: {
        id: account._id?.toString() ?? session.user.id,
        email: account.email,
        name: account.name,
        username: account.username ?? null,
        role: account.role ?? "user",
        createdAt: account.createdAt ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to load account:", error);
    return NextResponse.json({ error: "Failed to load account" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const updates: { name?: string; avatarUrl?: string; password?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  const errors: string[] = [];

  if (typeof payload.name === "string") {
    const name = sanitizeName(payload.name);
    if (!name) {
      errors.push("Name is required.");
    } else {
      updates.name = name;
    }
  }

  if (typeof payload.avatarUrl === "string") {
    updates.avatarUrl = payload.avatarUrl;
  }

  const wantsPassword =
    typeof payload.newPassword === "string" && payload.newPassword.length > 0;
  if (wantsPassword) {
    const currentPassword =
      typeof payload.currentPassword === "string" ? payload.currentPassword : "";
    const newPassword = String(payload.newPassword);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      errors.push(
        `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    } else if (!currentPassword) {
      errors.push("Current password is required to change your password.");
    } else {
      try {
        const { account } = await findAccount(
          session.user.id,
          session.user.email,
        );
        if (!account) {
          return NextResponse.json(
            { error: "Account not found" },
            { status: 404 },
          );
        }
        const valid = account.password
          ? await bcrypt.compare(currentPassword, account.password)
          : false;
        if (!valid) {
          errors.push("Current password is incorrect.");
        } else {
          updates.password = await bcrypt.hash(newPassword, 12);
        }
      } catch (error) {
        console.error("Password verification error:", error);
        return NextResponse.json(
          { error: "Failed to update password" },
          { status: 500 },
        );
      }
    }
  }

  if (errors.length) {
    return NextResponse.json({ error: errors[0], errors }, { status: 400 });
  }

  const hasChange =
    typeof updates.name === "string" || typeof updates.password === "string";
  if (!hasChange) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 });
  }

  try {
    const { users, account } = await findAccount(
      session.user.id,
      session.user.email,
    );
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    await users.updateOne({ _id: account._id }, { $set: updates });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to update account:", error);
    return NextResponse.json(
      { error: "Failed to update account" },
      { status: 500 },
    );
  }
}
