import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

import { connectToDatabase } from "@/lib/mongodb";
import { authRateLimiter, getClientIP } from "@/lib/rate-limit";
import { planUsername } from "@/lib/db/users";
import { User as DbUser } from "@/lib/types";

/** Users are keyed by ObjectId in Mongo even though the shared type says string. */
type UserDoc = Omit<DbUser, "_id"> & { _id?: ObjectId };

const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 80;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function sanitizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
}

/**
 * Public account creation.
 *
 * Mirrors the credentials provider in `lib/auth.ts`: the same lower-cased email
 * lookup and bcrypt hash so a freshly registered account can sign in straight
 * away. Returns 400 for invalid input, 409 for a duplicate email and 201 on
 * success.
 */
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  const limit = authRateLimiter.check(`register:${clientIP}`);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((limit.reset - Date.now()) / 1000)),
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const rawEmail = typeof payload.email === "string" ? payload.email : "";
  const rawPassword = typeof payload.password === "string" ? payload.password : "";
  const rawName = typeof payload.name === "string" ? payload.name : "";

  const email = normalizeEmail(rawEmail);
  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  if (rawPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const name = sanitizeName(rawName) || email.split("@")[0];

  try {
    const { db } = await connectToDatabase();
    const users = db.collection<UserDoc>("users");

    const existing = await users.findOne(
      { email },
      { projection: { _id: 1 } },
    );
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const now = new Date();
    const password = await bcrypt.hash(rawPassword, 12);
    // The public handle is minted at signup so the account has a profile URL
    // from day one, and so its first publish lands on that URL.
    const username = await planUsername(email, name);

    const result = await users.insertOne({
      email,
      password,
      name,
      username,
      role: "user",
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      { id: result.insertedId.toString(), email, name, username },
      { status: 201 },
    );
  } catch (error) {
    // A unique index on email may reject the write even if the pre-check passed.
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: number }).code === 11000
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "We couldn't create your account. Please try again." },
      { status: 500 },
    );
  }
}
