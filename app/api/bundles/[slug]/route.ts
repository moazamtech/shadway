import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getBundleBySlug,
  getBundleComponents,
  updateBundle,
  deleteBundle,
  hasBundleAccess,
} from "@/lib/db/bundles";
import { presentBundle, presentComponent } from "@/lib/bundles/present";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Ctx) {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);
    const viewerId = session?.user?.id;

    const bundle = await getBundleBySlug(slug, viewerId);
    if (!bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    // A private bundle is only visible to the person who curates it.
    const isAuthor = Boolean(viewerId && bundle.author.userId === viewerId);
    if (!bundle.isPublic && !isAuthor) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    const components = await getBundleComponents(bundle.componentSlugs);
    const canReadSource = hasBundleAccess(bundle, bundle.plans, bundle.purchase, viewerId);

    return NextResponse.json({
      item: {
        ...presentBundle(bundle, bundle.plans, bundle.purchase),
        canReadSource,
        isAuthor,
        components: components.map((doc) => presentComponent(doc, canReadSource)),
      },
    });
  } catch (error) {
    console.error("Failed to read bundle:", error);
    return NextResponse.json({ error: "Failed to read bundle" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in to edit a bundle" }, { status: 401 });
    }

    const bundle = await getBundleBySlug(slug);
    if (!bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }
    if (bundle.author.userId !== session.user.id) {
      return NextResponse.json({ error: "You can only edit your own bundles" }, { status: 403 });
    }

    const body = await request.json();
    const patch: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) {
      patch.name = body.name.trim();
    }
    if (typeof body.description === "string") patch.description = body.description;
    if (typeof body.coverImageUrl === "string") patch.coverImageUrl = body.coverImageUrl;
    if (typeof body.isPublic === "boolean") patch.isPublic = body.isPublic;
    if (typeof body.featured === "boolean") patch.featured = body.featured;

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await updateBundle(slug, patch);
    if (!updated) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }
    return NextResponse.json({ item: presentBundle(updated, bundle.plans, null) });
  } catch (error) {
    console.error("Failed to update bundle:", error);
    return NextResponse.json({ error: "Failed to update bundle" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in to delete a bundle" }, { status: 401 });
    }

    const bundle = await getBundleBySlug(slug);
    if (!bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }
    if (bundle.author.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You can only delete your own bundles" },
        { status: 403 }
      );
    }

    const removed = await deleteBundle(slug);
    if (!removed) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, slug });  } catch (error) {
    console.error("Failed to delete bundle:", error);
    return NextResponse.json({ error: "Failed to delete bundle" }, { status: 500 });
  }
}

