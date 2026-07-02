import { router, protectedProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import { CommunicationPreference } from '~/lib/generated/enums';

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
    .input(
      z.object({
        name: z.string().min(1).optional(),
        communicationPreference: z.enum(['EMAIL', 'SMS', 'BOTH', 'NONE']).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: { name?: string; communicationPreference?: CommunicationPreference } = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.communicationPreference !== undefined) {
        updateData.communicationPreference = input.communicationPreference;
      }
      return prisma.user.update({
        where: { id: ctx.session.user.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
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

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
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
