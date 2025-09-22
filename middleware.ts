import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    console.log('Middleware running for:', req.nextUrl.pathname);
    console.log('Token:', req.nextauth.token);

    // Admin routes protection
    if (req.nextUrl.pathname.startsWith('/admin')) {
      // Allow access to login page
      if (req.nextUrl.pathname === '/admin/login') {
        console.log('Allowing access to login page');
        return NextResponse.next();
      }

      // Check if user is authenticated and has admin role
      if (!req.nextauth.token || req.nextauth.token.role !== 'admin') {
        console.log('Redirecting to login - token missing or not admin');
        return NextResponse.redirect(new URL('/admin/login', req.url));
      }

      console.log('Admin access granted');
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