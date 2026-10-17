import { NextResponse } from "next/server";
import { listComponents } from "@/lib/db/components";
import { serializeCard } from "@/lib/serialize";

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
    const rows = await listComponents({
      author: decodeURIComponent(username),
      limit: 60,
    });
    const items = rows.map(serializeCard);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    console.error("Failed to list author components:", error);
    return NextResponse.json({ error: "Failed to load author" }, { status: 500 });
  }
}