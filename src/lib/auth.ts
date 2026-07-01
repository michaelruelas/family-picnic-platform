import NextAuth from 'next-auth';
import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
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

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
export { getServerSession } from 'next-auth';
