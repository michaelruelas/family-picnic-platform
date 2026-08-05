import { router, protectedProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import { CommunicationPreference } from '~/lib/generated/enums';
import { profileUpdateSchema } from '~/lib/schemas/profile';

/**
 * Best-effort IP extraction from a Headers object. Returns null when
 * no IP-bearing header is present (e.g. local development or an
 * upstream proxy that strips forwarding headers). Used by
 * `updatePreferences` to record the source of an SMS consent grant
 * so an audit can later verify the opt-in came from a real session.
 */
function extractClientIp(headers: Headers | undefined): string | null {
  if (!headers) return null;
  const candidates = ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'true-client-ip'];
  for (const name of candidates) {
    const value = headers.get(name);
    if (!value) continue;
    const first = value.split(',')[0]?.trim();
    if (first) return first;
  }
  return null;
}

export const userRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        communicationPreference: true,
        phoneNumber: true,
        smsConsent: true,
        smsConsentAt: true,
        household: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    return user;
  }),

  updatePreferences: protectedProcedure
    .input(profileUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const updateData: {
        name?: string;
        communicationPreference?: CommunicationPreference;
        phoneNumber?: string | null;
        smsConsent?: boolean;
        smsConsentAt?: Date | null;
        smsConsentIp?: string | null;
      } = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.communicationPreference !== undefined) {
        updateData.communicationPreference = input.communicationPreference;
      }
      if (input.phoneNumber !== undefined) {
        updateData.phoneNumber = input.phoneNumber;
      }
      if (input.smsConsent !== undefined) {
        updateData.smsConsent = input.smsConsent;
        if (input.smsConsent) {
          updateData.smsConsentAt = new Date();
          // Stamp the IP so an audit can later verify the opt-in
          // came from a real session. Falls back to null when no
          // IP-bearing header is present (local dev, stripped proxy).
          const ip = extractClientIp(ctx.headers);
          if (ip) updateData.smsConsentIp = ip;
        } else {
          updateData.smsConsentAt = null;
          updateData.smsConsentIp = null;
        }
      }
      return prisma.user.update({
        where: { id: ctx.session.user.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          communicationPreference: true,
          phoneNumber: true,
          smsConsent: true,
          household: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }),

  getByHousehold: protectedProcedure
    .input(z.object({ householdId: z.string() }))
    .query(async ({ input }) => {
      return prisma.user.findMany({
        where: { householdId: input.householdId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          communicationPreference: true,
        },
      });
    }),

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    return prisma.user.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        communicationPreference: true,
        household: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }),

  searchByEmail: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      return prisma.user.findUnique({
        where: { email: input.email },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          household: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }),

  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    return prisma.user.update({
      where: { id: ctx.session.user.id },
      data: { onboardingCompletedAt: new Date() },
      select: {
        id: true,
        name: true,
        email: true,
        household: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }),
});
