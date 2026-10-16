import { NextResponse } from "next/server";

import type { PreviewFileInput } from "@/lib/preview/shadcn-ui";
import { compileProjectCssCached } from "@/lib/preview/tailwind";

/**
 * Compiles the studio project's stylesheet.
 *
 * The preview itself is Sandpack — the bundle is built in the visitor's
 * browser and nothing runs on the host. Styles are the one thing the sandbox
 * cannot do on its own: Tailwind has to read the project's own `globals.css`
 * and the design system's custom variants and utilities, which the in-browser
 * build cannot resolve. So the same compiler the publish build uses runs here
 * and hands back one plain stylesheet, which the sandbox injects as
 * `/styles.css`.
 *
 * The vendored shadcn/ui sources are folded in server-side, so a request
 * carries only the author's own files — and the response carries back just the
 * vendored files the project actually reaches, which is what the sandbox
 * mounts. The client never sees the full registry.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { files?: PreviewFileInput[]; styleCode?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const files = (Array.isArray(body.files) ? body.files : []).filter(
    (file): file is PreviewFileInput =>
      !!file && typeof file.path === "string" && typeof file.content === "string"
  );

  if (files.length === 0) {
    return NextResponse.json({ error: "No files to compile." }, { status: 400 });
  }

  const styleCode =
    body.styleCode ?? files.find((file) => file.path.endsWith(".css"))?.content;

  try {
    const { css, vendored } = await compileProjectCssCached(files, styleCode);
    return NextResponse.json({ css, vendored });
  } catch (error) {
    console.error("[preview-css] compile failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not compile styles." },
      { status: 422 }
    );
  }
}
