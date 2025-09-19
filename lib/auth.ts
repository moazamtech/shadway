import { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from './mongodb';
import { User } from './types';

declare module 'next-auth' {
  interface User extends NextAuthUser {
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
          const users = db.collection<User>('users');

          console.log('Looking for user with email:', credentials.email);
          const user = await users.findOne({ email: credentials.email });

          if (!user) {
            console.log('User not found');
            return null;
          }

          console.log('User found, checking password...');
          const isValidPassword = await bcrypt.compare(credentials.password, user.password);

          if (!isValidPassword) {
            console.log('Invalid password');
            return null;
          }

          console.log('Login successful for user:', user.email);
          return {
            id: user._id!.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/admin/login',
  },
};