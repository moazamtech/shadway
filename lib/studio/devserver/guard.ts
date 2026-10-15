import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { getComponentBySlugAnyStatus } from "@/lib/db/components";

export type StudioDraft = NonNullable<
  Awaited<ReturnType<typeof getComponentBySlugAnyStatus>>
>;

export type DraftAccess = {
  draft: StudioDraft | null;
  userId: string | null;
  response: NextResponse | null;
};

/**
 * Resolves the draft behind a preview request and checks the caller owns it
 * (or is an admin). Returns the response to send when access is refused.
 */
export async function requireDraft(slug: string): Promise<DraftAccess> {
  const { session, response } = await requireSession();
  if (response || !session) {
    return {
      draft: null,
      userId: null,
      response:
        response ??
        NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    };
  }

  const draft = await getComponentBySlugAnyStatus(slug);
  if (!draft) {
    return {
      draft: null,
      userId: null,
      response: NextResponse.json({ error: "Component not found" }, { status: 404 }),
    };
  }

  const isOwner = draft.author.userId === session.user.id;
  const isAdmin = session.user.role === "admin";
  if (!isOwner && !isAdmin) {
    return {
      draft: null,
      userId: null,
      response: NextResponse.json({ error: "Not allowed" }, { status: 403 }),
    };
  }

  return { draft, userId: session.user.id, response: null };
}
