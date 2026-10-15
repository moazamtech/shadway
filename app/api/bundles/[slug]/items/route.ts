import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  addComponentToBundle,
  removeComponentFromBundle,
  getBundleBySlug,
} from "@/lib/db/bundles";
import { getComponentsCollection } from "@/lib/db/components";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * Shared owner check. Only the curator may curate, which keeps a bundle's
 * contents from being edited by anyone who guesses the slug.
 */
async function requireOwner(bundleSlug: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Sign in to curate a bundle" }, { status: 401 }) };
  }

  const bundle = await getBundleBySlug(bundleSlug);
  if (!bundle) {
    return { error: NextResponse.json({ error: "Bundle not found" }, { status: 404 }) };
  }
  if (bundle.author.userId !== session.user.id) {
    return {
      error: NextResponse.json(
        { error: "You can only curate your own bundles" },
        { status: 403 }
      ),
    };
  }

  return { bundle };
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { slug } = await params;
    const guard = await requireOwner(slug);
    if (guard.error) return guard.error;

    const body = await request.json();
    const componentSlug = String(body.componentSlug || body.slug || "").trim();

    if (!componentSlug) {
      return NextResponse.json({ error: "componentSlug is required" }, { status: 400 });
    }

    // Confirm the component is actually public before letting it into a bundle.
    const components = await getComponentsCollection();
    const component = await components.findOne({
      slug: componentSlug,
      status: "published",
      visibility: "public",
    });

    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

    const componentSlugs = await addComponentToBundle(slug, componentSlug);
    if (!componentSlugs) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    return NextResponse.json({ componentSlugs });
  } catch (error) {
    console.error("Failed to add component to bundle:", error);
    return NextResponse.json({ error: "Failed to add component" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { slug } = await params;
    const guard = await requireOwner(slug);
    if (guard.error) return guard.error;

    const body = await request.json();
    const componentSlug = String(body.componentSlug || body.slug || "").trim();

    if (!componentSlug) {
      return NextResponse.json({ error: "componentSlug is required" }, { status: 400 });
    }

    const componentSlugs = await removeComponentFromBundle(slug, componentSlug);
    if (!componentSlugs) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    return NextResponse.json({ componentSlugs });
  } catch (error) {
    console.error("Failed to remove component from bundle:", error);
    return NextResponse.json({ error: "Failed to remove component" }, { status: 500 });
  }
}
