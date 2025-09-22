import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // Admin routes protection
    if (req.nextUrl.pathname.startsWith('/admin')) {
      // Allow access to login page
      if (req.nextUrl.pathname === '/admin/login') {
        return NextResponse.next();
      }

      // Check if user is authenticated and has admin role
      if (!req.nextauth.token || req.nextauth.token.role !== 'admin') {
        return NextResponse.redirect(new URL('/admin/login', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Always allow access to login page
        if (req.nextUrl.pathname === '/admin/login') {
          return true;
        }

        // For admin routes, require admin role
        if (req.nextUrl.pathname.startsWith('/admin')) {
          return token?.role === 'admin';
        }

        // Allow all other routes
        return true;
      },
    },
  }
);

export const config = {
  matcher: ['/admin/:path*']
};