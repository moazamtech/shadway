import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq, sql } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { getVibecodeBySlug, insertVibecode } from "@/lib/db/content";
import { db } from "@/lib/db/postgres";
import { vibecode } from "@/lib/db/schema";
import { VibecodeComponent } from "@/lib/types";

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 24;
const MAX_PAYLOAD_CHARS = 500_000;

function sanitizeText(input: string, maxLength: number) {
  return input.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function slugify(input: string) {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  return base || "vibecode";
}

function normalizeTags(tags: unknown) {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter(Boolean)
    .map((tag) => tag.slice(0, MAX_TAG_LENGTH));
  return Array.from(new Set(cleaned)).slice(0, MAX_TAGS);
}

function validateFiles(files: unknown) {
  if (!files) return undefined;
  if (typeof files !== "object" || Array.isArray(files)) return null;
  const entries = Object.entries(files as Record<string, unknown>);
  const normalized: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (typeof key !== "string" || typeof value !== "string") return null;
    if (!key.trim() || !value.trim()) continue;
    const path = key.startsWith("/") ? key : `/${key}`;
    normalized[path] = value;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function estimatePayloadSize(payload: Record<string, unknown>) {
  try {
    return JSON.stringify(payload).length;
  } catch {
    return MAX_PAYLOAD_CHARS + 1;
  }
}

/**
 * The author's record, as the API has always answered with it.
 *
 * The column holds the record as JSON. A row that was written while the
 * column was text carries the record as a JSON string inside it, so it is
 * unwrapped here; a record that is already an object is left alone.
 */
function authorOf(value: unknown): VibecodeComponent["createdBy"] {
  if (value && typeof value === "object") {
    return value as VibecodeComponent["createdBy"];
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        return parsed as VibecodeComponent["createdBy"];
      }
    } catch {
      // A record that was flattened into a string cannot be read back. The
      // answer keeps the shape of the field rather than dropping it.
    }
  }
  return { id: "", name: "", email: "" };
}

/**
 * A row as the document the API has always answered with.
 *
 * The row carries its key under the name the column has, and the document has
 * always carried it as `_id`. They are the same string, and only the one the
 * clients know goes out, so an answer cannot tell which database it came from.
 */
type VibecodeDocument = Omit<
  typeof vibecode.$inferSelect,
  "id" | "createdBy"
> & {
  _id: string;
  createdBy: VibecodeComponent["createdBy"];
};

function asDocument(row: typeof vibecode.$inferSelect): VibecodeDocument {
  const { id, createdBy, ...document } = row;
  return { _id: id, ...document, createdBy: authorOf(createdBy) };
}

/**
 * The key of a row that was just written.
 *
 * The accessors answer with the document, and the document carries its key as
 * `_id`. The shared type allows the key to be missing, so it is read out
 * rather than asserted: a row that came back without a key was not written.
 */
function keyOf(document: VibecodeComponent): string {
  const key = document._id;
  if (!key) {
    throw new Error("a vibecode component came back without a key");
  }
  return key;
}

export async function GET() {
  try {
    // The published drops, newest first. The accessor lists every drop, and
    // the gallery is only ever the published ones, so the query is written
    // out here rather than filtered out of a longer list.
    const rows = await db()
      .select()
      .from(vibecode)
      .where(eq(vibecode.status, "published"))
      .orderBy(
        // Mongo put a missing date last and Postgres puts it first, so the
        // order says which end a drop without a date belongs at.
        sql`${vibecode.publishedAt} desc nulls last`,
        sql`${vibecode.createdAt} desc nulls last`,
      );

    return NextResponse.json(rows.map(asDocument));
  } catch (error) {
    console.error("Error fetching vibecode items:", error);
    return NextResponse.json(
      { error: "Failed to fetch vibecode items" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const rawTitle = typeof body?.title === "string" ? body.title : "";
    const rawDescription =
      typeof body?.description === "string" ? body.description : "";
    const title = sanitizeText(rawTitle, MAX_TITLE_LENGTH);
    const description = sanitizeText(rawDescription, MAX_DESCRIPTION_LENGTH);
    const category =
      typeof body?.category === "string"
        ? sanitizeText(body.category, 40)
        : undefined;
    const tags = normalizeTags(body?.tags);
    const prompt =
      typeof body?.prompt === "string"
        ? sanitizeText(body.prompt, 800)
        : undefined;
    const thumbnailUrl =
      typeof body?.thumbnailUrl === "string" ? body.thumbnailUrl.trim() : "";
    const code = typeof body?.code === "string" ? body.code : undefined;
    const files = validateFiles(body?.files);
    let entryFile =
      typeof body?.entryFile === "string" ? body.entryFile : undefined;
    const language = typeof body?.language === "string" ? body.language : "tsx";

    if (!title || !description) {
      return NextResponse.json(
        { error: "Title and description are required" },
        { status: 400 },
      );
    }

    if (!code && !files) {
      return NextResponse.json(
        { error: "Generated code or files are required" },
        { status: 400 },
      );
    }

    if (files === null) {
      return NextResponse.json(
        { error: "Invalid files payload" },
        { status: 400 },
      );
    }

    if (entryFile && !entryFile.startsWith("/")) {
      entryFile = `/${entryFile}`;
    }

    if (entryFile && files && !files[entryFile]) {
      return NextResponse.json(
        { error: "Entry file does not exist in files payload" },
        { status: 400 },
      );
    }

    const estimatedSize = estimatePayloadSize({
      title,
      description,
      prompt,
      category,
      tags,
      code,
      files,
      entryFile,
    });
    if (estimatedSize > MAX_PAYLOAD_CHARS) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    const baseSlug = slugify(title);
    let slug = baseSlug;
    let suffix = 1;
    while (await getVibecodeBySlug(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const item = await insertVibecode({
      title,
      description,
      slug,
      prompt,
      category,
      tags,
      thumbnailUrl: thumbnailUrl || undefined,
      code,
      files,
      entryFile: entryFile || undefined,
      language,
      status: "published",
      viewCount: 0,
      createdBy: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
      publishedAt: new Date(),
    });

    return NextResponse.json(
      { message: "Vibecode component published", id: keyOf(item), slug },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error publishing vibecode component:", error);
    return NextResponse.json(
      { error: "Failed to publish vibecode component" },
      { status: 500 },
    );
  }
}
