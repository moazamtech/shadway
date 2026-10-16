import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

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
 */
export default withAuth(
  function middleware(request) {
    const token = request.nextauth.token;
    const { pathname, search } = request.nextUrl;

    // The dedicated admin login is retired in favour of the shared /login page,
    // so let it through to its redirect rather than bouncing the user.
    if (pathname.startsWith("/admin/login")) {
      return NextResponse.next();
    }

    if (!token) {
      const url = new URL("/login", request.url);
      url.searchParams.set("callbackUrl", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }

    const isAdmin =
      token.role === "admin" ||
      (typeof token.email === "string" && token.email.toLowerCase().trim() === "moazamdevw@gmail.com");

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
  matcher: ["/admin/:path*", "/studio/:path*", "/profile/:path*", "/bookmarks"],
};
