import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { getComponentBySlugAnyStatus } from "@/lib/db/components";
import { findSandboxForDraft, saveSandboxForDraft } from "@/lib/db/sandboxes";
import { SANDBOX_ROOT, isSandboxConfigured } from "@/lib/studio/sandbox/config";
import { SANDBOX_INDEX_CSS_PREFIX, sandboxSeedFiles } from "@/lib/studio/sandbox/project";
import { createStudioSandbox, startStudioSandbox } from "@/lib/studio/sandbox/server";

export const runtime = "nodejs";

/**
 * Opens the dev-server sandbox behind a draft.
 *
 * POST { slug } -> { configured, sandboxId, startData, isNew, seedFiles }
 *
 * The first call creates the VM and returns the files to seed it with; every
 * later call resumes the same sandbox, so the dev server picks up where the
 * author left off. Without a CodeSandbox token the route answers
 * `configured: false` and the studio keeps its browser-side preview.
 */
export async function POST(request: NextRequest) {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "Database is not configured. Set MONGODB_URI to open a sandbox." },
      { status: 503 }
    );
  }

  const { session, response: authError } = await requireSession();
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const slug = String(body?.slug || "").trim();
  if (!slug) {
    return NextResponse.json({ error: "Missing component slug" }, { status: 400 });
  }

  const component = await getComponentBySlugAnyStatus(slug);
  if (!component) {
    return NextResponse.json({ error: "Component not found" }, { status: 404 });
  }

  const isOwner = component.author.userId === session.user.id;
  const isAdmin = session.user.role === "admin";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  if (!isSandboxConfigured()) {
    return NextResponse.json({
      configured: false,
      reason: "Set CSB_API_KEY to run previews on a real dev server.",
    });
  }

  const userId = session.user.id;
  const title = component.title || component.name || slug;

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
      sandboxId,
      startData,
      isNew,
      rootPath: SANDBOX_ROOT,
      indexCssPrefix: SANDBOX_INDEX_CSS_PREFIX,
      seedFiles: isNew ? sandboxSeedFiles(component) : undefined,
    });
  } catch (error) {
    console.error("[studio-sandbox] Failed to open sandbox:", error);
    return NextResponse.json({ error: "Failed to open the sandbox" }, { status: 502 });
  }
}
