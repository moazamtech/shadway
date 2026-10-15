import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createBundle, listBundles } from "@/lib/db/bundles";
import { presentBundle } from "@/lib/bundles/present";
import { getComponentsCollection } from "@/lib/db/components";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ items: [], count: 0, degraded: true });
  }

  try {
    const { searchParams } = new URL(request.url);
    const author = searchParams.get("author") ?? undefined;
    const q = searchParams.get("q") ?? undefined;
    const limit = Number(searchParams.get("limit") || 12);
    const includePrivate = searchParams.get("includePrivate") === "true";

    const session = await getServerSession(authOptions);
    const viewerId = session?.user?.id;

    const found = await listBundles({ q, author, limit, includePrivate }, viewerId);

    // One batched lookup for every component across every bundle, so cards can
    // render a preview strip without an N+1 query storm.
    const allSlugs = [...new Set(found.flatMap((bundle) => bundle.componentSlugs))];
    let previewsBySlug = new Map<string, {
      slug: string;
      title?: string;
      thumbnailUrl?: string;
      videoUrl?: string;
    }>();

    if (allSlugs.length) {
      const collection = await getComponentsCollection();
      const components = await collection
        .find(
          {
            slug: { $in: allSlugs },
            status: "published",
            visibility: "public",
          },
          { projection: { slug: 1, title: 1, thumbnailUrl: 1, videoUrl: 1 } }
        )
        .toArray();
      previewsBySlug = new Map(components.map((doc) => [doc.slug, doc]));
    }

    const items = found.map((bundle) => ({
      ...presentBundle(bundle, bundle.plans, bundle.purchase),
      previews: bundle.componentSlugs
        .slice(0, 10)
        .map((slug) => previewsBySlug.get(slug))
        .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
        .map((doc) => ({
          slug: doc.slug,
          title: doc.title,
          thumbnailUrl: doc.thumbnailUrl,
          videoUrl: doc.videoUrl,
        })),
    }));

    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    console.error("Failed to list bundles:", error);
    return NextResponse.json({ error: "Failed to list bundles" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "Database is not configured. Set MONGODB_URI to create bundles." },
      { status: 503 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in to create a bundle" }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const componentSlugs: string[] = Array.isArray(body.componentSlugs)
      ? body.componentSlugs.map(String)
      : [];

    if (name.length < 3) {
      return NextResponse.json({ error: "Bundle name is required" }, { status: 400 });
    }

    if (componentSlugs.length > 50) {
      return NextResponse.json(
        { error: "A bundle can hold at most 50 components" },
        { status: 400 }
      );
    }

    // Only accept components that actually exist and are publicly visible,
    // otherwise the bundle would render permanent empty slots.
    if (componentSlugs.length) {
      const components = await getComponentsCollection();
      const found = await components
        .find(
          { slug: { $in: componentSlugs }, status: "published", visibility: "public" },
          { projection: { slug: 1 } }
        )
        .toArray();
      const known = new Set(found.map((doc) => doc.slug));
      const unknown = componentSlugs.filter((slug) => !known.has(slug));

      if (unknown.length) {
        return NextResponse.json(
          { error: `Unknown components: ${unknown.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const item = await createBundle({
      name,
      description: String(body.description || ""),
      author: {
        userId: session.user.id,
        name: session.user.name || session.user.email || "Anonymous",
        username:
          (session.user as { username?: string }).username ||
          session.user.email?.split("@")[0] ||
          "anonymous",
        avatar: (session.user as { image?: string }).image || undefined,
      },
      componentSlugs,
      coverImageUrl: body.coverImageUrl ? String(body.coverImageUrl) : undefined,
      // New bundles start as drafts so half-finished curation is never public.
      isPublic: body.isPublic === true,
    });

    return NextResponse.json({ item: presentBundle(item, [], null) }, { status: 201 });
  } catch (error) {
    console.error("Failed to create bundle:", error);
    return NextResponse.json({ error: "Failed to create bundle" }, { status: 500 });
  }
}
