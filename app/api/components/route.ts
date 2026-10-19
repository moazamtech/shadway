import { NextRequest, NextResponse } from "next/server";
import { requireSession, resolveAuthor } from "@/lib/auth/require-session";
import {
  listComponents,
  createComponent,
  isValidSlug,
  getComponentsCollection,
  type ComponentVisibility,
} from "@/lib/db/components";
import { PREVIEW_BUILD_VERSION, buildComponentBundle } from "@/lib/preview/build";
import { collectNpmDependencies } from "@/lib/studio/deps";
import { componentPreviewFiles } from "@/lib/preview/server-files";
import { serializeCard } from "@/lib/serialize";
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

    // The feed is a grid of images: it gets the card projection, serialized,
    // and never the source or the prebuilt preview document behind each card.
    const items = components.map(serializeCard);

    return NextResponse.json({ items, count: items.length });
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
    const isAdmin = session.user.role === "admin";
    const collection = await getComponentsCollection();

    // Visibility is an editorial decision: only admins set it. Everything a
    // user submits stays public-by-default pending review; admins may mark a
    // component unlisted at approval time.
    const visibility = (isAdmin && body.visibility === "unlisted" ? "unlisted" : "public") as ComponentVisibility;

    // User flow: publishing submits the component for review. A user-facing
    // status is only ever "pending" — an admin has to approve it before it
    // appears in the marketplace. Admins still publish their own directly.
    const submissionStatus = isAdmin ? ("published" as const) : ("pending" as const);

    const publishFields = {
      name: String(body.name || title).replace(/\s+/g, "-"),
      title,
      description,
      code,
      componentPath: body.componentPath ? String(body.componentPath) : undefined,
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
      visibility,
    };

    /**
     * Publishing an existing draft updates it in place, so the project keeps
     * its slug, files and history instead of creating a second record.
     *
     * The slug doubles as the record's identity here, which is what used to
     * make a rename impossible: `requestedSlug` was only ever a *lookup key*, so
     * a slug that did not match found nothing and the create path ran — leaving
     * the original draft orphaned beside its own replacement, both public.
     *
     * `identitySlug` is the address the author is editing, and it travels with
     * the record; `requestedSlug` is what they want it to be called.
     */
    const identitySlug =
      typeof body.draftSlug === "string" && body.draftSlug ? body.draftSlug : requestedSlug;

    const existing = identitySlug ? await collection.findOne({ slug: identitySlug }) : null;

    let item: Awaited<ReturnType<typeof createComponent>>;
    if (existing) {
      const isOwner = existing.author.userId === session.user.id;
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      }

      /**
       * A rename, if the author asked for one. The slug is the component's
       * permanent address, so it is held to the same rules as a new one and
       * refused outright when the target is taken — the unique index would
       * reject it anyway, and a raw `E11000` escaping as a generic 500 tells an
       * author nothing about which part of their URL was wrong.
       */
      let renamed: string | null = null;
      if (requestedSlug && requestedSlug !== existing.slug) {
        if (!isValidSlug(requestedSlug)) {
          return NextResponse.json(
            { error: "That URL is not usable. Lowercase letters, numbers and single hyphens only." },
            { status: 400 }
          );
        }

        const occupant = await collection.findOne(
          { slug: requestedSlug },
          { projection: { _id: 1 } }
        );
        if (occupant) {
          return NextResponse.json(
            { error: "That URL is already taken." },
            { status: 409 }
          );
        }

        renamed = requestedSlug;
      }

      const updates = {
        ...publishFields,
        ...(renamed ? { slug: renamed } : {}),
        featured: existing.featured,
        version: existing.version,
        license: existing.license,
        status: submissionStatus,
        publishedAt: existing.publishedAt ?? new Date(),
        updatedAt: new Date(),
      };

      await collection.updateOne(
        { slug: existing.slug },
        { $set: updates, $unset: { previewHtml: "", previewHash: "", previewVersion: "" } }
      );
      item = { ...existing, ...updates };
    } else {
      item = await createComponent({
        slug: requestedSlug && isValidSlug(requestedSlug) ? requestedSlug : undefined,
        ...publishFields,
        author,
        status: submissionStatus,
        featured: false,
        version: String(body.version || "1.0.0"),
        license: String(body.license || "MIT"),
      });
    }

    // Build the component once, at publish time. The marketplace then serves
    // a finished document instead of building on every visit.
    let previewHtml: string | undefined;
    let previewHash: string | undefined;

    try {
      const files = componentPreviewFiles({
        code: item.code,
        componentPath: item.componentPath,
        demoCode: item.demoCode,
        styleCode: item.styleCode,
        files: item.files,
      });

      const bundle = await buildComponentBundle(files, {
        entry: DEFAULT_DEMO_PATH,
        title: item.title,
      });

      previewHtml = bundle.html;
      previewHash = bundle.hash;

      // Auto-detect npm packages actually imported by the component so
      // authors don't have to list them by hand.
      const declared = Array.isArray(body.dependencies) ? body.dependencies : [];
      const detected = collectNpmDependencies(files);
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
        { $set: { previewHtml, previewHash, previewVersion: PREVIEW_BUILD_VERSION, updatedAt: new Date() } }
      );
      item.previewHtml = previewHtml;
      item.previewHash = previewHash;
      item.previewVersion = PREVIEW_BUILD_VERSION;

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
              `${item.slug}-cover.webp`,
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
