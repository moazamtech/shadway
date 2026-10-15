import { NextResponse } from "next/server";
import { transpilePreview, previewEntryFor, type PreviewFile } from "@/lib/preview/transpile";
import { withShadcnFiles } from "@/lib/preview/server-files";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 200_000;
const MAX_FILES = 40;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawFiles = Array.isArray(body.files) ? body.files : [];

    if (!rawFiles.length) {
      return NextResponse.json({ error: "files are required" }, { status: 400 });
    }
    if (rawFiles.length > MAX_FILES) {
      return NextResponse.json({ error: "too many files" }, { status: 413 });
    }

    const files: PreviewFile[] = rawFiles.map((file: { path?: unknown; content?: unknown }) => ({
      path: String(file?.path ?? ""),
      content: String(file?.content ?? ""),
    }));

    for (const file of files) {
      if (file.content.length > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `${file.path} is too large` }, { status: 413 });
      }
    }

    // The studio sends only what the author wrote; the shadcn/ui files their
    // imports resolve to are added here.
    const withUi = withShadcnFiles(files);
    const resolvedEntry = body.entry ? String(body.entry) : previewEntryFor(withUi);
    const result = await transpilePreview(withUi, resolvedEntry);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Preview transpile failed:", error);
    const message = error instanceof Error ? error.message : "Failed to transpile preview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}