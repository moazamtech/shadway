import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import type { ComponentFile } from "@/lib/db/components";
import { DEFAULT_DEMO_PATH, DEFAULT_STYLE_PATH } from "@/lib/studio/starter";
import {
  ensureDevServer,
  getDevServer,
  stopDevServer,
  syncDevServerFiles,
} from "@/lib/studio/devserver/runner";
import type { SandboxDraft } from "@/lib/studio/sandbox/project";

export const runtime = "nodejs";

/**
 * A real Next.js dev server for a generated project.
 *
 * POST { sessionId, files, page, style, dependencies }
 *   First call materializes the project and boots `next dev`; every later call
 *   writes the changed files into the same workspace, so the running server hot
 *   reloads. `GET  ?sessionId=` reads status + the log tail; `DELETE` stops it.
 *
 * The session id comes from the client and is namespaced per user here, so two
 * visitors can never land in each other's workspace.
 */

/** Files the scaffold owns or that have no meaning in an App Router project. */
const IGNORED = new Set([
  "/index.html",
  "/index.tsx",
  "/index.jsx",
  "/index.js",
  "/index.css",
  "/package.json",
  "/tsconfig.json",
  "/App.css",
]);

const PROJECT_PATH = /^\/(?!.*\.\.)[^\\]+$/;

function pathType(path: string): string {
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (/\.(tsx|ts|jsx|js)$/.test(path)) return "ts";
  return "file";
}

/** Strips every `@import` rule — the scaffold supplies Tailwind and the theme. */
function cleanStyle(css: string): string {
  return css
    .replace(/@import\s+url\([^)]*\)\s*;?/g, "")
    .replace(/@import\s+["'][^"']+["']\s*;?/g, "")
    .trim();
}

type Body = {
  sessionId?: unknown;
  files?: unknown;
  page?: unknown;
  style?: unknown;
  dependencies?: unknown;
};

function readBody(body: Body): {
  files: Record<string, string>;
  page: string;
  style: string;
  dependencies: string[];
} | null {
  const rawFiles = body.files;
  if (!rawFiles || typeof rawFiles !== "object") return null;

  const files: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawFiles as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    const path = key.startsWith("/") ? key : `/${key}`;
    if (IGNORED.has(path) || !PROJECT_PATH.test(path)) continue;
    files[path] = value;
  }
  if (!Object.keys(files).length) return null;

  const page = typeof body.page === "string" && body.page.trim() ? body.page : null;
  if (!page) return null;

  const style = typeof body.style === "string" ? cleanStyle(body.style) : "";

  const dependencies = Array.isArray(body.dependencies)
    ? (body.dependencies as unknown[])
        .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
        .map((name) => name.trim())
    : [];

  return { files, page, style, dependencies };
}

/** The draft shape the sandbox seed already knows how to write. */
function toDraft(input: {
  files: Record<string, string>;
  page: string;
  style: string;
  dependencies: string[];
}): SandboxDraft {
  const files: ComponentFile[] = Object.entries(input.files).map(([path, content]) => ({
    path,
    content,
    type: pathType(path),
  }));

  return {
    code: "",
    demoCode: input.page,
    styleCode: input.style,
    dependencies: input.dependencies,
    files,
  };
}

/**
 * The workspace key for a session id. Signed-in visitors are namespaced by
 * account; everyone else still gets a real dev server, namespaced by the
 * session id alone so two anonymous visitors can never share a workspace.
 */
async function sessionKey(sessionId: string): Promise<string> {
  const { session, response } = await requireSession();
  if (response || !session) return `anon--${sessionId}`;
  return `${session.user.id}--${sessionId}`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;

  const sessionId = String(body.sessionId || "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 });
  }

  const key = await sessionKey(sessionId);
  if (!key) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const input = readBody(body);
  if (!input) {
    return NextResponse.json({ error: "Missing project files" }, { status: 400 });
  }

  const existing = getDevServer(key);
  if (existing && existing.status !== "error") {
    // The page and the stylesheet are scaffold-owned files derived from the
    // request, so they are rewritten alongside the project files.
    const writes: Record<string, string> = {
      ...input.files,
      [DEFAULT_DEMO_PATH]: input.page,
    };
    if (input.style) writes[DEFAULT_STYLE_PATH] = input.style;
    await syncDevServerFiles(key, writes, []);
    return NextResponse.json({ configured: true, ...existing });
  }
  if (existing) {
    // A server that died is replaced rather than reported forever.
    await stopDevServer(key);
  }

  try {
    const server = await ensureDevServer(key, toDraft(input));
    return NextResponse.json({ configured: true, ...server });
  } catch (error) {
    console.error("[preview-devserver] Could not start the dev server:", error);
    return NextResponse.json(
      {
        error: "Failed to start the dev server",
        detail: error instanceof Error ? error.message : undefined,
      },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  const sessionId = (request.nextUrl.searchParams.get("sessionId") || "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 });
  }

  const key = await sessionKey(sessionId);
  if (!key) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const server = getDevServer(key);
  if (!server) {
    return NextResponse.json({
      configured: true,
      engine: "local",
      status: "stopped",
      logs: [],
    });
  }

  return NextResponse.json({ configured: true, ...server });
}

export async function DELETE(request: NextRequest) {
  const sessionId = (request.nextUrl.searchParams.get("sessionId") || "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 });
  }

  const key = await sessionKey(sessionId);
  if (!key) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  return NextResponse.json({ stopped: await stopDevServer(key) });
}
