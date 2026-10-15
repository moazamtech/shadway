import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { toggleLike, getLikeState } from "@/lib/db/marketplace";

export const runtime = "nodejs";

/**
 * Like a component.
 *
 * POST   -> toggles the like for the signed-in account, returns the new state.
 * DELETE -> clears the like for the signed-in account.
 *
 * Both are keyed on the account id from the session, never on an IP address, so
 * a like is the account's and follows it across devices.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in to like components" },
      { status: 401 }
    );
  }

  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  try {
    const liked = await toggleLike(session.user.id, decodeURIComponent(slug));
    return NextResponse.json({ liked, slug });
  } catch (error) {
    console.error("Failed to like component:", error);
    return NextResponse.json(
      { error: "Failed to like component" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  try {
    const current = await getLikeState(session.user.id, decodeURIComponent(slug));
    if (current) {
      await toggleLike(session.user.id, decodeURIComponent(slug));
    }
    return NextResponse.json({ liked: false, slug });
  } catch (error) {
    console.error("Failed to unlike component:", error);
    return NextResponse.json(
      { error: "Failed to unlike component" },
      { status: 500 }
    );
  }
}

/** Whether the signed-in account has liked this component. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ liked: false });
  }

  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ liked: false });
  }

  try {
    const liked = await getLikeState(
      session.user.id,
      decodeURIComponent(slug)
    );
    return NextResponse.json({ liked });
  } catch (error) {
    console.error("Failed to read like state:", error);
    return NextResponse.json({ liked: false });
  }
}
