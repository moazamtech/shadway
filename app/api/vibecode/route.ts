import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
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

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const vibecode = db.collection<VibecodeComponent>("vibecode");
    const items = await vibecode
      .find({ status: "published" })
      .sort({ publishedAt: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json(items);
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

    const { db } = await connectToDatabase();
    const vibecode = db.collection<VibecodeComponent>("vibecode");

    const baseSlug = slugify(title);
    let slug = baseSlug;
    let suffix = 1;
    while (await vibecode.findOne({ slug })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const now = new Date();
    const item: Omit<VibecodeComponent, "_id"> = {
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
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    };

    const result = await vibecode.insertOne(item);

    return NextResponse.json(
      { message: "Vibecode component published", id: result.insertedId, slug },
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
