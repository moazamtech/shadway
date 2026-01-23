import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { User as DbUser } from "@/lib/types";

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

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const body = await request.json();
    const rawEmail = typeof body?.email === "string" ? body.email : undefined;
    const rawName = typeof body?.name === "string" ? body.name : undefined;
    const newPassword =
      typeof body?.password === "string" ? body.password : undefined;
    const currentPassword =
      typeof body?.currentPassword === "string" ? body.currentPassword : "";

    const updates: Partial<DbUser> = {};
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

    const { db } = await connectToDatabase();
    const users = db.collection<DbUser>("users");
    const targetId = new ObjectId(id);
    const targetUser = await users.findOne({ _id: targetId });

    if (!targetUser || targetUser.role !== "admin") {
      return NextResponse.json(
        { error: "Admin user not found" },
        { status: 404 },
      );
    }

    const isSelf = targetUser._id?.toString() === session.user.id;
    if (isSelf && (newPassword || updates.email)) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required" },
          { status: 400 },
        );
      }
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        targetUser.password,
      );
      if (!isValidPassword) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 401 },
        );
      }
    }

    if (updates.email && updates.email !== targetUser.email) {
      const existing = await users.findOne({ email: updates.email });
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

    updates.updatedAt = new Date();

    const result = await users.findOneAndUpdate(
      { _id: targetId },
      { $set: updates },
      { returnDocument: "after", projection: { password: 0 } },
    );

    if (!result?.value) {
      return NextResponse.json(
        { error: "Admin user not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(result.value);
  } catch (error) {
    console.error("Error updating admin user:", error);
    return NextResponse.json(
      { error: "Failed to update admin user" },
      { status: 500 },
    );
  }
}
