import { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from './mongodb';
import { ensureUsername } from './db/users';
import { User as DbUser } from './types';

declare module 'next-auth' {
  interface User {
    role: string;
    /**
     * The handle this account owns, minted at sign-in. Optional because a token
     * issued before this field existed will not carry it until the next sign-in;
     * callers fall back to `/profile`, which resolves the handle server-side.
     */
    username?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      username?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string;
    username?: string;
  }
}

export const ADMIN_EMAILS = new Set([
  'moazamdevw@gmail.com',
]);

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase().trim());
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('Missing credentials');
          return null;
        }

        try {
          const { db } = await connectToDatabase();
          const users = db.collection<DbUser>('users');

          const normalizedEmail = credentials.email.toLowerCase().trim();
          const user = await users.findOne({
            email: { $regex: `^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
          });

          if (!user) {
            // SECURITY: Don't log specific failure reasons in production
            return null;
          }

          const isValidPassword = await bcrypt.compare(credentials.password, user.password);

          if (!isValidPassword) {
            // SECURITY: Don't log specific failure reasons in production
            return null;
          }

          const isAdmin = user.role === 'admin' || isAdminEmail(user.email);
          const role = isAdmin ? 'admin' : (user.role || 'user');

          if (isAdmin && user.role !== 'admin') {
            void users.updateOne({ _id: user._id }, { $set: { role: 'admin' } });
          }

          // SECURITY: Only log successful logins in development
          if (process.env.NODE_ENV === 'development') {
            console.log('Login successful for user:', user.email);
          }

          /**
           * Resolve the handle now, once, rather than leaving every link to guess.
           *
           * There are exactly two ways to know a handle. `ensureUsername` reads
           * or mints the one the account actually owns; `deriveHandleFromEmail`
           * guesses from the address. They agree until a handle collides with an
           * existing account, at which point `allocateHandle` suffixes this one
           * and the guess starts pointing at somebody else's profile. Signing in
           * is the moment the account is already being written to, so this is
           * where the authoritative value belongs — and it means a brand-new
           * account has a profile URL before it has ever visited one.
           */
          const username = await ensureUsername(user.email).catch(() => null);

          return {
            id: user._id!.toString(),
            email: user.email,
            name: user.name,
            role,
            username: username ?? undefined,
          };
        } catch (error) {
          // SECURITY: Log errors but don't expose details to client
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // 1 hour
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = isAdminEmail(user.email) ? 'admin' : user.role;
        // Only written when it is actually present: an absent handle must leave
        // the previous value alone rather than overwrite it with `undefined`,
        // which is what would drop the handle on any token refresh that carries
        // a `user` object without one.
        if (user.username) token.username = user.username;
      } else if (token.email && isAdminEmail(token.email)) {
        token.role = 'admin';
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!;
        session.user.role = isAdminEmail(session.user?.email || token.email) ? 'admin' : token.role;
        if (token.username) session.user.username = token.username;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};