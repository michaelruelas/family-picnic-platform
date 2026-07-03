import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';

function devCredentialsProvider() {
  const adminUsername = process.env.DEV_AUTH_USERNAME;
  const adminPassword = process.env.DEV_AUTH_PASSWORD;

  return CredentialsProvider({
    id: 'dev-credentials',
    name: 'Dev Credentials',
    credentials: {
      username: { label: 'Username', type: 'text' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (process.env.DEV_AUTH_ENABLED !== 'true') {
        return null;
      }

      if (!credentials?.username || !credentials?.password) {
        return null;
      }

      if (
        adminUsername &&
        adminPassword &&
        credentials.username === adminUsername &&
        credentials.password === adminPassword
      ) {
        const devEmail = 'dev-admin@family-picnic.local';
        let user = await prisma.user.findUnique({ where: { email: devEmail } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: devEmail,
              name: adminUsername,
              role: 'ADMIN',
            },
          });
        }
        return { id: user.id, email: user.email, name: user.name };
      }

      const user = await prisma.user.findFirst({
        where: {
          email: credentials.username,
          devPassword: credentials.password,
          deletedAt: null,
        },
      });

      if (user) {
        return { id: user.id, email: user.email, name: user.name };
      }

      return null;
    },
  });
}

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.DEV_AUTH_ENABLED === 'true' ? [devCredentialsProvider()] : []),
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        const user = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { id: true, role: true, householdId: true },
        });
        if (user) {
          session.user.id = user.id;
          session.user.role = user.role;
          session.user.householdId = user.householdId;
        }
      }
      return session;
    },
    async signIn({ account, profile }) {
      if (account?.provider === 'dev-credentials') {
        return true;
      }
      if (account?.provider === 'google' && profile?.email) {
        const existing = await prisma.user.findUnique({
          where: { email: profile.email },
        });
        if (!existing) {
          await prisma.user.create({
            data: {
              email: profile.email,
              name: profile.name ?? profile.email,
              role: 'ADMIN_ADULT',
            },
          });
        }
        return true;
      }
      return false;
    },
  },
};

export { getServerSession } from 'next-auth';
