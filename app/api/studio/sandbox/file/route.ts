import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { installedPathFor, vendoredPathFor } from "@/lib/preview/shadcn-ui";
import { SHADCN_FILES } from "@/lib/preview/template/bundle";

export const runtime = "nodejs";

/**
 * Hands the studio a vendored shadcn/ui file on demand, addressed by its
 * import specifier (`@/components/ui/dialog`).
 *
 * The sandbox preview calls this when Vite reports an import the VM does not
 * have on disk yet, so a newly typed `import { Dialog } from
 * "@/components/ui/dialog"` heals itself — the same way the browser-side
 * preview resolves it, but for real this time.
 */
export async function GET(request: NextRequest) {
  const { response: authError } = await requireSession();
  if (authError) return authError;

  const specifier = request.nextUrl.searchParams.get("specifier")?.trim() || "";
  const vendored = vendoredPathFor(specifier);
  const content = vendored ? SHADCN_FILES[vendored] : undefined;

  if (!vendored || content === undefined) {
    return NextResponse.json({ error: "Unknown shadcn/ui file" }, { status: 404 });
  }

  return NextResponse.json({ path: installedPathFor(vendored), content });
}
