import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  deleteVibecode,
  getVibecodeBySlug,
  updateVibecode,
} from "@/lib/db/content";
import { VibecodeComponent } from "@/lib/types";

type RouteParams = {
  params: Promise<{ slug: string }>;
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
function asDocument(item: VibecodeComponent & { id?: string }): VibecodeComponent {
  const { id, ...document } = item;
  return {
    _id: id ?? document._id,
    ...document,
    createdBy: authorOf(document.createdBy),
  };
}

/**
 * The key of a row.
 *
 * The accessors answer with the document, and the document carries its key as
 * `_id`. The shared type allows the key to be missing, so it is read out
 * rather than asserted: a row that came back without a key is not a row the
 * route can act on.
 */
function keyOf(item: VibecodeComponent): string {
  const key = item._id;
  if (!key) {
    throw new Error("a vibecode component came back without a key");
  }
  return key;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  try {
    const item = await getVibecodeBySlug(slug);

    if (!item || item.status !== "published") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // The count moves after the row was read, so the answer is the drop as it
    // was before this visit and the next one is the drop after it.
    await updateVibecode(keyOf(item), { viewCount: (item.viewCount ?? 0) + 1 });

    return NextResponse.json(asDocument(item));
  } catch (error) {
    console.error("Error fetching vibecode item:", error);
    return NextResponse.json(
      { error: "Failed to fetch vibecode item" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { slug } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!slug) {
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

    const item = await getVibecodeBySlug(slug);
    if (!item) {
      return NextResponse.json(
        { error: "Vibecode component not found" },
        { status: 404 },
      );
    }

    /**
     * A category that was not in the body is written as null.
     *
     * Mongo turned the missing value into a null, so clearing the category in
     * the admin panel cleared it in the catalogue. The accessor writes the
     * fields it is given and leaves the others alone, and the shared type has
     * no null for a category, so the null is written here where the request
     * is read.
     */
    const categoryOrNull = (category ?? null) as unknown as string;

    const updated = await updateVibecode(keyOf(item), {
      title,
      description,
      category: categoryOrNull,
      tags,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Vibecode component not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(asDocument(updated));
  } catch (error) {
    console.error("Error updating vibecode component:", error);
    return NextResponse.json(
      { error: "Failed to update vibecode component" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const item = await getVibecodeBySlug(slug);
    if (!item) {
      return NextResponse.json(
        { error: "Vibecode component not found" },
        { status: 404 },
      );
    }

    await deleteVibecode(keyOf(item));

    return NextResponse.json({ message: "Vibecode component deleted" });
  } catch (error) {
    console.error("Error deleting vibecode component:", error);
    return NextResponse.json(
      { error: "Failed to delete vibecode component" },
      { status: 500 },
    );
  }
}
