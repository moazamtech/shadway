import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  BUNDLE_PLAN_TYPES,
  deleteBundlePlan,
  getBundleBySlug,
  upsertBundlePlan,
  type BundlePlanType,
} from "@/lib/db/bundles";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

async function requireOwner(bundleSlug: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Sign in to manage plans" }, { status: 401 }) };
  }

  const bundle = await getBundleBySlug(bundleSlug);
  if (!bundle) {
    return { error: NextResponse.json({ error: "Bundle not found" }, { status: 404 }) };
  }
  if (bundle.author.userId !== session.user.id) {
    return {
      error: NextResponse.json(
        { error: "You can only manage plans on your own bundles" },
        { status: 403 }
      ),
    };
  }

  return { bundle };
}

function parsePlanType(value: unknown): BundlePlanType | null {
  const type = String(value ?? "");
  return BUNDLE_PLAN_TYPES.includes(type as BundlePlanType)
    ? (type as BundlePlanType)
    : null;
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { slug } = await params;
    const guard = await requireOwner(slug);
    if (guard.error) return guard.error;

    const body = await request.json();
    const type = parsePlanType(body.type);

    if (!type) {
      return NextResponse.json(
        { error: `type must be one of: ${BUNDLE_PLAN_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Prices are stored in cents; reject anything that isn't a sane amount.
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json(
        { error: "price must be a positive number of cents" },
        { status: 400 }
      );
    }
    if (price > 1_000_000) {
      return NextResponse.json({ error: "price is unreasonably high" }, { status: 400 });
    }

    const plan = await upsertBundlePlan({
      bundleSlug: slug,
      type,
      description: String(body.description || ""),
      price,
      features: Array.isArray(body.features) ? body.features.map(String) : [],
    });

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("Failed to save bundle plan:", error);
    return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { slug } = await params;
    const guard = await requireOwner(slug);
    if (guard.error) return guard.error;

    const body = await request.json();
    const type = parsePlanType(body.type);

    if (!type) {
      return NextResponse.json(
        { error: `type must be one of: ${BUNDLE_PLAN_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const removed = await deleteBundlePlan(slug, type);
    if (!removed) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, type });
  } catch (error) {
    console.error("Failed to delete bundle plan:", error);
    return NextResponse.json({ error: "Failed to delete plan" }, { status: 500 });
  }
}
