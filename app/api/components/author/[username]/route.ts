import { NextResponse } from "next/server";
import { listComponents } from "@/lib/db/components";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  try {
    const items = await listComponents({ author: decodeURIComponent(username), limit: 60 });
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    console.error("Failed to list author components:", error);
    return NextResponse.json({ error: "Failed to load author" }, { status: 500 });
  }
}