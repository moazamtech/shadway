import { NextRequest, NextResponse } from "next/server";

import { requireDraft } from "@/lib/studio/devserver/guard";
import { syncDevServerFiles } from "@/lib/studio/devserver/runner";

export const runtime = "nodejs";

/**
 * Mirrors an editor change into the draft's running dev server.
 *
 * POST { slug, files?: { [path]: content }, remove?: string[] }
 *
 * The Next.js dev server watches the workspace, so a write here is a real hot
 * reload inside the preview iframe. Only the local engine needs this — the
 * CodeSandbox VM is written to over the SDK.
 */
export async function POST(request: NextRequest) {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "Database is not configured. Set MONGODB_URI to sync files." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const slug = String(body?.slug || "").trim();
  if (!slug) {
    return NextResponse.json({ error: "Missing component slug" }, { status: 400 });
  }

  const { draft, response } = await requireDraft(slug);
  if (!draft) return response!;

  const files =
    body?.files && typeof body.files === "object"
      ? (body.files as Record<string, string>)
      : {};
  const remove = Array.isArray(body?.remove)
    ? (body.remove as unknown[]).filter((path): path is string => typeof path === "string")
    : [];

  const synced = await syncDevServerFiles(slug, files, remove);
  return NextResponse.json({ synced });
}
