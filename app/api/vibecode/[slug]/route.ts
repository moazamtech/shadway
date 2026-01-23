import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { VibecodeComponent } from "@/lib/types";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type RouteParams = {
  params: { slug: string };
};

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 24;

function sanitizeText(input: string, maxLength: number) {
  return input.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeTags(tags: unknown) {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter(Boolean)
    .map((tag) => tag.slice(0, MAX_TAG_LENGTH));
  return Array.from(new Set(cleaned)).slice(0, MAX_TAGS);
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { db } = await connectToDatabase();
    const vibecode = db.collection<VibecodeComponent>("vibecode");
    const item = await vibecode.findOne({
      slug: params.slug,
      status: "published",
    });

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await vibecode.updateOne(
      { _id: item._id },
      { $inc: { viewCount: 1 }, $set: { updatedAt: new Date() } },
    );

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error fetching vibecode item:", error);
    return NextResponse.json(
      { error: "Failed to fetch vibecode item" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!params.slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
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

    if (!title || !description) {
      return NextResponse.json(
        { error: "Title and description are required" },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();
    const vibecode = db.collection<VibecodeComponent>("vibecode");

    const update = {
      title,
      description,
      category,
      tags,
      updatedAt: new Date(),
    };

    const result = await vibecode.findOneAndUpdate(
      { slug: params.slug },
      { $set: update },
      { returnDocument: "after" },
    );

    if (!result?.value) {
      return NextResponse.json(
        { error: "Vibecode component not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(result.value);
  } catch (error) {
    console.error("Error updating vibecode component:", error);
    return NextResponse.json(
      { error: "Failed to update vibecode component" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!params.slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const vibecode = db.collection<VibecodeComponent>("vibecode");
    const result = await vibecode.deleteOne({ slug: params.slug });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Vibecode component not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ message: "Vibecode component deleted" });
  } catch (error) {
    console.error("Error deleting vibecode component:", error);
    return NextResponse.json(
      { error: "Failed to delete vibecode component" },
      { status: 500 },
    );
  }
}
