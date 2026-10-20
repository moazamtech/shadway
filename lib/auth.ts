import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { ensureUsername, findAccountByEmail, findAccountBySession } from './db/users';

declare module 'next-auth' {
  interface User {
    role: string;
    /**
     * The handle this account owns, minted at sign-in. Optional because a token
     * issued before this field existed will not carry it until the next sign-in;
     * callers fall back to `/profile`, which resolves the handle server-side.
     */
    username?: string;
    /** The profile photo, mirrored from the account at sign-in and on update. */
    image?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      username?: string;
      /**
       * The account's photo. It lives on the account, not on the token, because
       * the settings page writes it from a different request — the `jwt`
       * callback below re-reads it when the client asks for a refresh.
       */
      image?: string | null;
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
          console.error('Missing credentials');
          return null;
        }

        try {
          const normalizedEmail = credentials.email.toLowerCase().trim();
          const user = await findAccountByEmail(normalizedEmail);

          if (!user) {
            // SECURITY: Don't log specific failure reasons in production
            return null;
          }

          const isValidPassword = await bcrypt.compare(credentials.password, user.password ?? '');

          if (!isValidPassword) {
            // SECURITY: Don't log specific failure reasons in production
            return null;
          }

          const isAdmin = user.role === 'admin' || isAdminEmail(user.email);
          const role = isAdmin ? 'admin' : (user.role || 'user');

          if (isAdmin && user.role !== 'admin') {
            const { users } = await findAccountBySession(user._id ?? '', user.email);
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
            image: user.avatar || undefined,
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
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = isAdminEmail(user.email) ? 'admin' : user.role;
        // Only written when it is actually present: an absent handle must leave
        // the previous value alone rather than overwrite it with `undefined`,
        // which is what would drop the handle on any token refresh that carries
        // a `user` object without one.
        if (user.username) token.username = user.username;
        /**
         * The photo, carried as `picture` — the field NextAuth copies into
         * `session.user.image`. `undefined` clears it, which is what a removed
         * photo is: leaving the old URL here would show a picture the account
         * no longer has.
         */
        token.picture = user.image ?? undefined;
      } else {
        if (token.email && isAdminEmail(token.email)) {
          token.role = 'admin';
        }
        /**
         * A photo is uploaded and saved by `/api/profile/avatar`, which is a
         * different request from the one that minted this token. Nothing in the
         * token can know the account changed, so a client that has just saved
         * asks for a refresh (`useSession().update()`), and this is the read
         * that answers it. The value comes from the database, never from the
         * refresh payload: otherwise a caller could point their own avatar at
         * any URL and have every page render it.
         */
        if (trigger === 'update' && token.sub) {
          const found = await findAccountBySession(token.sub, token.email ?? null).catch(() => null);
          const account = found?.account;
          if (account) {
            token.picture = account.avatar || undefined;
            if (account.name) token.name = account.name;
            if (account.username) token.username = account.username;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!;
        session.user.role = isAdminEmail(session.user?.email || token.email) ? 'admin' : token.role;
        if (token.username) session.user.username = token.username;
        session.user.image = token.picture ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};