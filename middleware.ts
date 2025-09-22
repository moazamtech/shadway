import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    console.log('Middleware running for:', req.nextUrl.pathname);
    console.log('Token:', req.nextauth.token);

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        console.log('Authorized callback - pathname:', req.nextUrl.pathname);
        console.log('Authorized callback - token:', token);

        // Always allow access to login page
        if (req.nextUrl.pathname === '/admin/login') {
          return true;
        }

        // For admin routes, require admin role
        if (req.nextUrl.pathname.startsWith('/admin')) {
          const hasAdminRole = token?.role === 'admin';
          console.log('Has admin role:', hasAdminRole);
          return hasAdminRole;
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