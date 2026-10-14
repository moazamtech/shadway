import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getComponentBySlug,
  incrementComponentMetric,
} from "@/lib/db/components";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "Missing component slug" }, { status: 400 });
  }

  try {
    const component = await getComponentBySlug(decodeURIComponent(slug));
    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

    // Fire-and-forget view metric; do not delay response.
    void incrementComponentMetric(component.slug, "views").catch(() => {});

    return NextResponse.json({ item: component });
  } catch (error) {
    console.error("Failed to fetch component:", error);
    return NextResponse.json({ error: "Failed to fetch component" }, { status: 500 });
  }
}
