import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  getComponentBySlugAnyStatus,
  incrementComponentMetric,
  getComponentsCollection,
  DETAIL_FIELDS,
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
    // Any-status fetch: an owner can always preview their own component, even
    // while it sits in the review queue — the same page customers will get,
    // minus the install endpoint, which stays published-only.
    //
    // Projected to the source: this route exists to show the author's code, and
    // the preview iframe fetches the built document from its own endpoint.
    const component = await getComponentBySlugAnyStatus(decoded, {
      projection: DETAIL_FIELDS,
    });
    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

    const isPublished = component.status === "published";

    if (!isPublished) {
      const { session } = await requireSession();
      const isOwner = Boolean(session?.user.id && component.author.userId === session.user.id);
      const isAdmin = session?.user.role === "admin";
      if (!isOwner && !isAdmin) {
        // Indistinguishable from "does not exist" — no leak of pending slugs.
        return NextResponse.json({ error: "Component not found" }, { status: 404 });
      }
    } else {
      void incrementComponentMetric(component.slug, "views").catch(() => {});
    }

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
    const removals: Record<string, ""> = {};

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

    if (isAdmin) {
      // Editorial fields are admin-only: users never choose their own
      // visibility or approval state.
      if (body.visibility === "public" || body.visibility === "unlisted")
        updates.visibility = body.visibility;
      if (body.featured !== undefined) updates.featured = Boolean(body.featured);
      if (
        body.status === "hidden" ||
        body.status === "published" ||
        body.status === "draft" ||
        body.status === "pending" ||
        body.status === "flagged"
      ) {
        updates.status = body.status;
        if (body.status === "published" && component.status !== "published") {
          updates.publishedAt = new Date();
        }
        if (body.status === "draft") removals.publishedAt = "";
      }
    } else {
      // Owners may only withdraw a pending submission back to a private
      // draft; publishing and visibility remain admin decisions.
      if (isOwner && body.status === "draft") {
        updates.status = "draft";
        removals.publishedAt = "";
      }
    }

    // The project's own files, saved from the studio. Content changes on a
    // published component invalidate the cached preview so the next visit
    // rebuilds it from the new source.
    const contentTouched =
      typeof body.code === "string" ||
      typeof body.componentPath === "string" ||
      typeof body.demoCode === "string" ||
      typeof body.styleCode === "string" ||
      Array.isArray(body.files);
    if (typeof body.code === "string" && body.code.trim()) updates.code = body.code;
    if (typeof body.componentPath === "string" && body.componentPath.startsWith("/")) {
      updates.componentPath = body.componentPath;
    }
    if (typeof body.demoCode === "string") updates.demoCode = body.demoCode;
    if (typeof body.styleCode === "string") updates.styleCode = body.styleCode;
    if (Array.isArray(body.files)) {
      const rawFiles: unknown[] = body.files;
      updates.files = rawFiles
        .filter(
          (file): file is { path: string; content: string; type?: string } =>
            Boolean(
              file &&
                typeof (file as { path?: unknown }).path === "string" &&
                typeof (file as { content?: unknown }).content === "string"
            )
        )
        .map((file) => ({
          path: file.path,
          content: file.content,
          type: file.type || "registry:file",
        }))
        .slice(0, 80);
    }
    if (contentTouched && component.status !== "draft") {
      removals.previewHtml = "";
      removals.previewHash = "";
    }

    await collection.updateOne(
      { slug: decoded },
      {
        $set: updates,
        ...(Object.keys(removals).length ? { $unset: removals } : {}),
      }
    );

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