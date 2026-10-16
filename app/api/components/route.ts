import { NextRequest, NextResponse } from "next/server";
import { requireSession, resolveAuthor } from "@/lib/auth/require-session";
import {
  listComponents,
  createComponent,
  isValidSlug,
  getComponentsCollection,
  type ComponentVisibility,
} from "@/lib/db/components";
import { buildPreviewBundle } from "@/lib/preview/bundle";
import { componentPreviewFiles } from "@/lib/preview/server-files";
import { DEFAULT_DEMO_PATH } from "@/lib/studio/starter";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ items: [], count: 0, degraded: true });
  }

  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q") ?? undefined;
    const tag = searchParams.get("tag") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const author = searchParams.get("author") ?? undefined;
    const sortParam = searchParams.get("sort");
    const sort =
      sortParam === "popular" ||
      sortParam === "installs" ||
      sortParam === "trending"
        ? sortParam
        : "latest";
    const limit = Number(searchParams.get("limit") || 24);

    const components = await listComponents({
      q,
      tag: tag ?? undefined,
      category: category ?? undefined,
      author: author ?? undefined,
      sort,
      limit,
    });

    return NextResponse.json({ items: components, count: components.length });
  } catch (error) {
    console.error("Failed to list components:", error);
    return NextResponse.json({ error: "Failed to list components" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "Database is not configured. Set MONGODB_URI to enable publishing." },
      { status: 503 }
    );
  }

  try {
    const { session, response: authError } = await requireSession();
    if (authError) return authError;

    const body = await request.json();

    const title = String(body.title || body.name || "").trim();
    const code = String(body.code || "").trim();
    const description = String(body.description || "").trim();
    const requestedSlug = body.slug ? String(body.slug) : undefined;

    if (!title || code.length < 20) {
      return NextResponse.json(
        { error: "Title and substantial code are required" },
        { status: 400 }
      );
    }

    if (code.length > 200_000) {
      return NextResponse.json({ error: "Component code is too large" }, { status: 413 });
    }

    if (!/export\s+(default|function|const|class)/.test(code)) {
      return NextResponse.json(
        { error: "Component code must export something" },
        { status: 400 }
      );
    }

    const author = await resolveAuthor(session);
    const collection = await getComponentsCollection();

    const publishFields = {
      name: String(body.name || title).replace(/\s+/g, "-"),
      title,
      description,
      code,
      demoCode: body.demoCode ? String(body.demoCode) : undefined,
      styleCode: body.styleCode ? String(body.styleCode) : undefined,
      files: Array.isArray(body.files) ? body.files : undefined,
      thumbnailUrl: body.thumbnailUrl ? String(body.thumbnailUrl) : undefined,
      videoUrl: body.videoUrl ? String(body.videoUrl) : undefined,
      category: String(body.category || "ui"),
      tags: Array.isArray(body.tags) ? body.tags : [],
      dependencies: Array.isArray(body.dependencies) ? body.dependencies : [],
      devDependencies: Array.isArray(body.devDependencies) ? body.devDependencies : [],
      registryDependencies: Array.isArray(body.registryDependencies)
        ? body.registryDependencies
        : [],
      cssVars: body.cssVars,
      visibility: (body.visibility === "unlisted" ? "unlisted" : "public") as ComponentVisibility,
    };

    // Publishing an existing draft updates it in place, so the project keeps
    // its slug, files and history instead of creating a second record.
    const existing = requestedSlug
      ? await collection.findOne({ slug: requestedSlug })
      : null;

    let item: Awaited<ReturnType<typeof createComponent>>;
    if (existing) {
      const isOwner = existing.author.userId === session.user.id;
      const isAdmin = session.user.role === "admin";
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      }

      const updates = {
        ...publishFields,
        featured: existing.featured,
        version: existing.version,
        license: existing.license,
        status: "pending" as const,
        publishedAt: existing.publishedAt ?? new Date(),
        updatedAt: new Date(),
      };

      await collection.updateOne(
        { slug: existing.slug },
        { $set: updates, $unset: { previewHtml: "", previewHash: "" } }
      );
      item = { ...existing, ...updates };
    } else {
      item = await createComponent({
        slug: requestedSlug && isValidSlug(requestedSlug) ? requestedSlug : undefined,
        ...publishFields,
        author,
        status: "published",
        featured: false,
        version: String(body.version || "1.0.0"),
        license: String(body.license || "MIT"),
      });
    }

    // Build the preview bundle once, at publish time. The feed then serves
    // static HTML instead of bundling on every visit.
    let previewHtml: string | undefined;
    let previewHash: string | undefined;

    try {
      const bundle = await buildPreviewBundle(
        componentPreviewFiles({
          code: item.code,
          demoCode: item.demoCode,
          styleCode: item.styleCode,
          files: item.files,
        }),
        { entry: DEFAULT_DEMO_PATH, title: item.title }
      );

      previewHtml = bundle.html;
      previewHash = bundle.hash;

      // Auto-detect npm packages actually imported by the component so
      // authors don't have to list them by hand.
      const declared = Array.isArray(body.dependencies) ? body.dependencies : [];
      const detected = bundle.externals ?? [];
      const merged = Array.from(
        new Set([
          ...detected.filter((name) => name !== "react" && name !== "react-dom"),
          ...declared.map(String),
        ])
      );

      if (merged.length !== (item.dependencies?.length ?? 0)) {
        await collection.updateOne(
          { slug: item.slug },
          { $set: { dependencies: merged, updatedAt: new Date() } }
        );
        item.dependencies = merged;
      }
    } catch (bundleError) {
      console.error("Preview bundle build failed:", bundleError);
    }

    if (previewHtml) {
      await collection.updateOne(
        { slug: item.slug },
        { $set: { previewHtml, previewHash, updatedAt: new Date() } }
      );
      item.previewHtml = previewHtml;
      item.previewHash = previewHash;

      // Capture a static cover image once, so the feed never bundles per visitor.
      if (!item.thumbnailUrl) {
        try {
          const { capturePreview } = await import("@/lib/preview/capture");
          const { uploadBufferToCloudinary } = await import("@/lib/cloudinary");
          const capture = await capturePreview(previewHtml, { width: 1200, height: 900 });

          if (capture) {
            const url = await uploadBufferToCloudinary(
              capture.buffer.buffer.slice(
                capture.buffer.byteOffset,
                capture.buffer.byteOffset + capture.buffer.byteLength
              ) as ArrayBuffer,
              `${item.slug}-cover.png`,
              `shadway-covers/${item.slug}`
            );
            await collection.updateOne(
              { slug: item.slug },
              { $set: { thumbnailUrl: url, updatedAt: new Date() } }
            );
            item.thumbnailUrl = url;
          }
        } catch (captureError) {
          console.error("Cover capture failed:", captureError);
        }
      }
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Failed to create component:", error);
    return NextResponse.json({ error: "Failed to create component" }, { status: 500 });
  }
}
