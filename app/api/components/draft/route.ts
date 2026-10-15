import { NextRequest, NextResponse } from "next/server";
import { requireSession, resolveAuthor } from "@/lib/auth/require-session";
import { createComponent, slugify } from "@/lib/db/components";
import { STARTER_FILES, DEFAULT_COMPONENT_PATH, DEFAULT_DEMO_PATH } from "@/lib/studio/starter";

export const runtime = "nodejs";

/**
 * Starts a new component: a private draft the studio can open immediately.
 *
 * A draft is invisible to the marketplace until it is published from the
 * studio — the same lifecycle as a sandbox on any component workbench.
 */
export async function POST(request: NextRequest) {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "Database is not configured. Set MONGODB_URI to create drafts." },
      { status: 503 }
    );
  }

  try {
    const { session, response: authError } = await requireSession();
    if (authError) return authError;

    const body = await request.json().catch(() => ({}));
    const requested = String(body?.title || "").trim();
    const title = requested || "Untitled component";
    const author = await resolveAuthor(session);

    const item = await createComponent({
      slug: slugify(title) || undefined,
      name: title.replace(/\s+/g, "-"),
      title,
      description: "",
      code: STARTER_FILES[DEFAULT_COMPONENT_PATH],
      demoCode: STARTER_FILES[DEFAULT_DEMO_PATH],
      files: [],
      category: "ui",
      tags: [],
      dependencies: [],
      devDependencies: [],
      registryDependencies: [],
      author,
      visibility: "unlisted",
      status: "draft",
      featured: false,
      version: "1.0.0",
      license: "MIT",
    });

    return NextResponse.json({ item: { slug: item.slug, title: item.title } });
  } catch (error) {
    console.error("Failed to create draft:", error);
    return NextResponse.json({ error: "Failed to create draft" }, { status: 500 });
  }
}
