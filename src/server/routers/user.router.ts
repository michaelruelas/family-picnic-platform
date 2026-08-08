import { router, protectedProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import { CommunicationPreference } from '~/lib/generated/enums';
import { profileUpdateSchema } from '~/lib/schemas/profile';
import { extractClientIp, parseTrustedProxyIps } from '~/lib/client-ip';
import {
  linkIdentityToCurrentUser,
  listLinkedIdentities,
  unlinkIdentity,
  IdentityAlreadyLinkedError,
  type OAuthProvider,
} from '~/lib/user-identity';

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
          // Stamp the source IP so an audit can later verify the
          // opt-in came from a real session. The trusted-proxy
          // allowlist is the only thing that makes x-forwarded-for
          // trustworthy; an empty allowlist (the safe default) means
          // no IP is recorded. Configure via TRUSTED_PROXY_IPS.
          const trusted = parseTrustedProxyIps(process.env.TRUSTED_PROXY_IPS);
          const { ip } = extractClientIp(ctx.headers ?? new Headers(), trusted);
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

  listLinkedIdentities: protectedProcedure.query(async ({ ctx }) => {
    return listLinkedIdentities(ctx.session.user.id);
  }),

  unlinkIdentity: protectedProcedure
    .input(z.object({ identityId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await unlinkIdentity(ctx.session.user.id, input.identityId);
      return { ok: true };
    }),

  // FPP-31: link an OAuth identity to the current user. The caller
  // must already have completed the OAuth flow and forwarded the
  // provider's stable subject id. The current session is the re-auth
  // proof (FPP-31 calls for "after re-auth"). If a password system
  // is added later, tighten this to require the password too.
  linkIdentity: protectedProcedure
    .input(
      z.object({
        provider: z.enum(['google', 'apple', 'facebook']),
        providerAccountId: z.string().min(1),
        emailSnapshot: z.string().email().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await linkIdentityToCurrentUser(ctx.session.user.id, {
          provider: input.provider as OAuthProvider,
          providerAccountId: input.providerAccountId,
          emailSnapshot: input.emailSnapshot ?? null,
        });
        return { id: result.id, provider: result.provider };
      } catch (error) {
        if (error instanceof IdentityAlreadyLinkedError) {
          throw new Error('That account is already linked to a different user.', {
            cause: error,
          });
        }
        throw error;
      }
    }),
});
