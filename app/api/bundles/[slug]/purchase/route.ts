import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  claimFreeBundle,
  getBundleBySlug,
  isBundleFree,
} from "@/lib/db/bundles";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * Claims access to a bundle.
 *
 * Free bundles (no priced plans) are granted immediately. Priced bundles need
 * a payment provider to confirm the charge — a client saying "I paid" is not
 * evidence, so this deliberately refuses until checkout is wired up. The 501
 * marks the seam where Stripe's webhook will confirm instead.
 */
export async function POST(_request: Request, { params }: Ctx) {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in to add this bundle" }, { status: 401 });
    }

    const bundle = await getBundleBySlug(slug, session.user.id);
    if (!bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }
    if (!bundle.isPublic && bundle.author.userId !== session.user.id) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    if (!isBundleFree(bundle.plans)) {
      return NextResponse.json(
        {
          error:
            "This bundle is a paid pack. Checkout is not enabled yet — payment confirmation will land here.",
        },
        { status: 501 }
      );
    }

    const purchase = await claimFreeBundle(slug, session.user.id);
    return NextResponse.json({ purchase, free: true });
  } catch (error) {
    console.error("Failed to claim bundle:", error);
    return NextResponse.json({ error: "Failed to add bundle" }, { status: 500 });
  }
}
