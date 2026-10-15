import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  getComponentBySlug,
  incrementComponentMetric,
  getComponentsCollection,
} from "@/lib/db/components";
import { requireSession } from "@/lib/auth/require-session";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "Missing component slug" }, { status: 400 });
  }

  const decoded = decodeURIComponent(slug);

  // Graceful fallback for local/demo environments without MongoDB.
  if (!process.env.MONGODB_URI) {
    const registryPath = path.join(process.cwd(), "registry", `${decoded}.json`);
    if (fs.existsSync(registryPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(registryPath, "utf8"));
        const firstFile = Array.isArray(raw.files) ? raw.files[0] : null;
        return NextResponse.json({
          item: {
            slug: decoded,
            title: raw.title || raw.name || decoded,
            description: raw.description || "",
            author: { name: "Shadway", username: "shadway", avatar: undefined },
            tags: raw.categories ? [raw.categories] : [],
            dependencies: raw.dependencies || [],
            registryDependencies: raw.registryDependencies || [],
            code: firstFile?.content || "",
            installs: raw.installs || 0,
            views: raw.views || 0,
            likes: raw.likes || 0,
          },
        });
      } catch (error) {
        console.error("Failed to read static component:", error);
      }
    }
    return NextResponse.json({ error: "Component not found" }, { status: 404 });
  }

  try {
    const component = await getComponentBySlug(decoded);
    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

    void incrementComponentMetric(component.slug, "views").catch(() => {});

    return NextResponse.json({ item: component });
  } catch (error) {
    console.error("Failed to fetch component:", error);
    return NextResponse.json({ error: "Failed to fetch component" }, { status: 500 });
  }
}

/** Owner-only metadata edits (title, description, tags, media, visibility). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);

  const { session, response: authError } = await requireSession();
  if (authError) return authError;

  try {
    const collection = await getComponentsCollection();
    const component = await collection.findOne({ slug: decoded });

    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

    const isOwner = component.author.userId === session.user.id;
    const isAdmin = session.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim();
    if (typeof body.description === "string") updates.description = body.description.trim();
    if (Array.isArray(body.tags)) updates.tags = body.tags.map(String).filter(Boolean);
    if (Array.isArray(body.dependencies))
      updates.dependencies = body.dependencies.map(String).filter(Boolean);
    if (typeof body.category === "string") updates.category = body.category;
    if (body.thumbnailUrl === null || typeof body.thumbnailUrl === "string")
      updates.thumbnailUrl = body.thumbnailUrl || undefined;
    if (body.videoUrl === null || typeof body.videoUrl === "string")
      updates.videoUrl = body.videoUrl || undefined;
    if (body.visibility === "public" || body.visibility === "unlisted")
      updates.visibility = body.visibility;
    if (typeof body.featured === "boolean" && isAdmin) updates.featured = body.featured;
    if (body.status === "hidden" || body.status === "published") {
      if (isAdmin || isOwner) updates.status = body.status;
    }

    await collection.updateOne({ slug: decoded }, { $set: updates });

    return NextResponse.json({ item: { ...component, ...updates } });
  } catch (error) {
    console.error("Failed to update component:", error);
    return NextResponse.json({ error: "Failed to update component" }, { status: 500 });
  }
}

/** Owner-only delete (admins can delete anything). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);

  const { session, response: authError } = await requireSession();
  if (authError) return authError;

  try {
    const collection = await getComponentsCollection();
    const component = await collection.findOne({ slug: decoded });

    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

    const isOwner = component.author.userId === session.user.id;
    const isAdmin = session.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    await collection.deleteOne({ slug: decoded });

    return NextResponse.json({ deleted: true, slug: decoded });
  } catch (error) {
    console.error("Failed to delete component:", error);
    return NextResponse.json({ error: "Failed to delete component" }, { status: 500 });
  }
}