import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import {
  createAccount,
  findAccountByEmail,
  listAdminAccounts,
} from "@/lib/db/users";

const MIN_PASSWORD_LENGTH = 12;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sanitizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 80);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(await listAdminAccounts());
  } catch (error) {
    console.error("Error fetching admin users:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin users" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const rawEmail = typeof body?.email === "string" ? body.email : "";
    const rawPassword = typeof body?.password === "string" ? body.password : "";
    const rawName = typeof body?.name === "string" ? body.name : "";
    const email = normalizeEmail(rawEmail);
    const name = sanitizeName(rawName || email.split("@")[0] || "Admin");

    if (!email || !rawPassword) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    if (rawPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 },
      );
    }

    const existing = await findAccountByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 12);
    const now = new Date();

    const account = await createAccount({
      email,
      password: hashedPassword,
      name,
      role: "admin",
    });

    return NextResponse.json(
      {
        _id: account._id,
        email,
        name,
        role: "admin",
        createdAt: now,
        updatedAt: now,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating admin user:", error);
    return NextResponse.json(
      { error: "Failed to create admin user" },
      { status: 500 },
    );
  }
}
