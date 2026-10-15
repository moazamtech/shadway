import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { toggleVote } from "@/lib/db/marketplace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const { slug } = await request.json();

    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    // Anonymous visitors get a session-scoped id so the UI still feels alive
    // without persisting bogus records against a shared key.
    const voterId = session?.user?.id ?? `anon:${request.headers.get("x-forwarded-for") ?? "local"}`;

    const voted = await toggleVote(voterId, slug);

    return NextResponse.json({ voted, slug });
  } catch (error) {
    console.error("Failed to toggle vote:", error);
    return NextResponse.json({ error: "Failed to toggle vote" }, { status: 500 });
  }
}