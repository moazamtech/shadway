import { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from './mongodb';
import { User as DbUser } from './types';

declare module 'next-auth' {
  interface User {
    role: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string;
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

          return {
            id: user._id!.toString(),
            email: user.email,
            name: user.name,
            role,
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
      } else if (token.email && isAdminEmail(token.email)) {
        token.role = 'admin';
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!;
        session.user.role = isAdminEmail(session.user?.email || token.email) ? 'admin' : token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};