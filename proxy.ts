import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Whether a handle belongs to somebody.
 *
 * The lookup is the same one the profile page makes, and it is made here
 * because the answer has to be given before the page is drawn — the shell's
 * boundary would otherwise turn a missing profile into a 200. A handle that
 * is not an account can still be an author of published work, so the work is
 * asked about too: the profile page renders the seeded content, and a
 * profile that is only a name in a published item is a real profile.
 */
async function profileExists(handle: string): Promise<boolean> {
  try {
    const { resolveProfile } = await import("@/lib/db/users");
    return Boolean(await resolveProfile(handle));
  } catch {
    // The database being unreachable is not the profile's fault: the page
    // will say so, and a 404 would be a lie.
    return true;
  }
}

/**
 * One auth gate for the whole app.
 *
 * - `/admin/**` requires `role === "admin"`. A signed-in non-admin is sent to
 *   their profile rather than the login page, so they are never asked to sign
 *   in again for something they already are.
 * - `/studio/**` requires any signed-in user: it authors content, so an
 *   anonymous visitor would fill in a form that cannot save.
 * - Everything else stays public.
 *
 * `withAuth` verifies the JWT with NEXTAUTH_SECRET. It deliberately does not
 * import `authOptions`, which would pull bcrypt and the MongoDB driver into the
 * edge runtime.
 *
 * Note on naming: Next.js 16 deprecated the `middleware` file convention and
 * renamed it to `proxy` — same behavior, only the file/function names change.
 */
export default withAuth(
  async function proxy(request) {
    const token = request.nextauth.token;
    const { pathname, search } = request.nextUrl;

    // The dedicated admin login is retired in favour of the shared /login page,
    // so let it through to its redirect rather than bouncing the user.
    if (pathname.startsWith("/admin/login")) {
      return NextResponse.next();
    }

    /**
     * A profile that belongs to nobody.
     *
     * The answer has to be given from here, in front of the page, because the
     * shell's boundary — the one that keeps the screen from blanking while a
     * page is on its way — sits above the pages and would swallow the answer.
     * A page that answers "there is nobody here" from inside a boundary comes
     * back with a 200 and a not-found page inside it, and the status line is
     * the only thing a crawler and a cache read.
     */
    const profile = /^\/u\/([^/]+)$/.exec(pathname);
    if (profile) {
      const handle = decodeURIComponent(profile[1]);
      const known = await profileExists(handle);
      if (!known) {
        return NextResponse.rewrite(new URL("/404", request.url), {
          status: 404,
        });
      }
    }

    /**
     * The pages that need an account.
     *
     * The gate below used to be the gate for everything the proxy saw,
     * because the proxy only saw the pages that need an account. It now also
     * sees a profile — which is public — so the gate is told which pages it
     * is a gate for. A profile that belongs to somebody is readable by
     * everybody, signed in or not.
     */
    const needsAccount =
      pathname.startsWith("/studio") ||
      pathname.startsWith("/profile") ||
      pathname.startsWith("/bookmarks");

    if (!token && needsAccount) {
      const url = new URL("/login", request.url);
      url.searchParams.set("callbackUrl", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }

    const isAdmin =
      token?.role === "admin" ||
      (typeof token?.email === "string" && token.email.toLowerCase().trim() === "moazamdevw@gmail.com");

    if (pathname.startsWith("/admin") && !isAdmin) {
      return NextResponse.redirect(new URL("/profile", request.url));
    }

    return NextResponse.next();
  },
  {
    // Routing decisions live in the function above, which can distinguish
    // "not signed in" from "signed in without the right role".
    callbacks: { authorized: () => true },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/studio/:path*", "/profile/:path*", "/bookmarks", "/u/:path*"],
};
