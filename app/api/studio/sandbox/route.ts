import { NextRequest, NextResponse } from "next/server";

import { findSandboxForDraft, saveSandboxForDraft } from "@/lib/db/sandboxes";
import { requireDraft } from "@/lib/studio/devserver/guard";
import {
  ensureDevServer,
  getDevServer,
  isLocalDevServerEnabled,
  stopDevServer,
} from "@/lib/studio/devserver/runner";
import { SANDBOX_ROOT, isSandboxConfigured } from "@/lib/studio/sandbox/config";
import { SANDBOX_STYLE_PREFIX, sandboxSeedFiles } from "@/lib/studio/sandbox/project";
import { createStudioSandbox, startStudioSandbox } from "@/lib/studio/sandbox/server";

export const runtime = "nodejs";

/**
 * The dev server behind a draft.
 *
 * POST { slug }   -> starts it (or returns the one already running)
 * GET  ?slug=     -> status + log tail, for polling while it boots
 * DELETE ?slug=   -> stops it
 *
 * Without a CodeSandbox token the project runs on a real `next dev` process on
 * this host and the studio points its preview straight at that server. With a
 * token it runs in a CodeSandbox VM instead. Either way the preview is a real
 * Next.js dev server — the same App Router project, real HMR, real errors.
 */
export async function POST(request: NextRequest) {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "Database is not configured. Set MONGODB_URI to open a preview." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const slug = String(body?.slug || "").trim();
  if (!slug) {
    return NextResponse.json({ error: "Missing component slug" }, { status: 400 });
  }

  const { draft, userId, response } = await requireDraft(slug);
  if (!draft || !userId) return response!;

  if (!isSandboxConfigured()) {
    if (!isLocalDevServerEnabled()) {
      return NextResponse.json({
        configured: false,
        reason: "Set CSB_API_KEY to run previews on a dev server.",
      });
    }

    try {
      const server = await ensureDevServer(slug, draft);
      return NextResponse.json({ configured: true, ...server });
    } catch (error) {
      console.error("[studio-sandbox] Local dev server failed to start:", error);
      return NextResponse.json(
        {
          error: "Failed to start the dev server",
          detail: error instanceof Error ? error.message : undefined,
        },
        { status: 502 }
      );
    }
  }

  const title = draft.title || draft.name || slug;

  try {
    let sandboxId: string | null = null;
    let startData = null;
    let isNew = false;

    const existing = await findSandboxForDraft(userId, slug);
    if (existing) {
      try {
        startData = await startStudioSandbox(existing.codesandboxId);
        sandboxId = existing.codesandboxId;
      } catch (error) {
        // Deleted or expired on CodeSandbox's side — a fresh VM replaces it.
        console.warn("[studio-sandbox] Could not resume; creating a new sandbox:", error);
      }
    }

    if (!sandboxId || !startData) {
      isNew = true;
      sandboxId = await createStudioSandbox(title);
      await saveSandboxForDraft({ userId, slug, codesandboxId: sandboxId, title });
      startData = await startStudioSandbox(sandboxId);
    }

    return NextResponse.json({
      configured: true,
      engine: "codesandbox",
      sandboxId,
      startData,
      isNew,
      rootPath: SANDBOX_ROOT,
      stylePrefix: SANDBOX_STYLE_PREFIX,
      seedFiles: isNew ? sandboxSeedFiles(draft) : undefined,
    });
  } catch (error) {
    console.error("[studio-sandbox] Failed to open sandbox:", error);
    return NextResponse.json({ error: "Failed to open the sandbox" }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "Database is not configured. Set MONGODB_URI to open a preview." },
      { status: 503 }
    );
  }

  const slug = (request.nextUrl.searchParams.get("slug") || "").trim();
  if (!slug) {
    return NextResponse.json({ error: "Missing component slug" }, { status: 400 });
  }

  const { draft, response } = await requireDraft(slug);
  if (!draft) return response!;

  const server = getDevServer(slug);
  if (!server) {
    return NextResponse.json({
      configured: true,
      engine: "local",
      slug,
      status: "stopped",
      logs: [],
    });
  }

  return NextResponse.json({ configured: true, ...server });
}

export async function DELETE(request: NextRequest) {
  const slug = (request.nextUrl.searchParams.get("slug") || "").trim();
  if (!slug) {
    return NextResponse.json({ error: "Missing component slug" }, { status: 400 });
  }

  const { draft, response } = await requireDraft(slug);
  if (!draft) return response!;

  const stopped = await stopDevServer(slug);
  return NextResponse.json({ stopped });
}
