import { router, protectedProcedure } from '~/lib/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import { logger } from '~/lib/logger';

export const dependentRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return prisma.dependent.findMany({
      where: {
        managedByUserId: ctx.session.user.id,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        relationship: z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'INLAW', 'COUSIN']),
        // FPP-122: age is required so the dependent feeds the
        // per-member attendance list and fee calc without
        // silently dropping out.
        age: z
          .number()
          .int('Age must be a whole number')
          .nonnegative('Age cannot be negative')
          .max(120, 'Age must be 120 or fewer'),
        dietaryLabels: z.array(z.string()).default([]),
        isChild: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: {
          id: true,
          householdId: true,
          household: { select: { id: true, deletedAt: true } },
        },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      // The householdId must reference a live Household row. A
      // user with no household (skipped onboarding) or whose
      // household was soft-deleted cannot create Dependents here;
      // route them back through onboarding instead. FPP-103.
      if (!user.household || user.household.deletedAt !== null) {
        logger.warn(
          {
            userId: user.id,
            householdId: user.householdId,
            householdDeletedAt: user.household?.deletedAt ?? null,
          },
          'dependent.create rejected: USER_HAS_NO_HOUSEHOLD',
        );
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'USER_HAS_NO_HOUSEHOLD',
        });
      }

      try {
        return await prisma.dependent.create({
          data: {
            name: input.name,
            relationship: input.relationship,
            age: input.age,
            dietaryLabels: input.dietaryLabels,
            isChild: input.isChild,
            householdId: user.household.id,
            managedByUserId: ctx.session.user.id,
          },
        });
      } catch (error) {
        logger.error(
          {
            err: error,
            userId: ctx.session.user.id,
            householdId: user.household.id,
            name: input.name,
            relationship: input.relationship,
          },
          'dependent.create failed',
        );
        throw error;
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        relationship: z
          .enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'INLAW', 'COUSIN'])
          .optional(),
        // FPP-122: keep the same bounds when updating. Reject
        // nulls here so we don't regress the required-age contract.
        age: z
          .number()
          .int('Age must be a whole number')
          .nonnegative('Age cannot be negative')
          .max(120, 'Age must be 120 or fewer')
          .optional(),
        dietaryLabels: z.array(z.string()).optional(),
        isChild: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existing = await prisma.dependent.findUnique({
        where: { id },
      });

      if (!existing || existing.deletedAt !== null) {
        throw new Error('Dependent not found');
      }

      if (existing.managedByUserId !== ctx.session.user.id) {
        throw new Error('Unauthorized');
      }

      return prisma.dependent.update({
        where: { id },
        data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.dependent.findUnique({
        where: { id: input.id },
      });

      if (!existing || existing.deletedAt !== null) {
        throw new Error('Dependent not found');
      }

      if (existing.managedByUserId !== ctx.session.user.id) {
        throw new Error('Unauthorized');
      }

      return prisma.dependent.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
    }),

  getByHousehold: protectedProcedure
    .input(z.object({ householdId: z.string() }))
    .query(async ({ input }) => {
      return prisma.dependent.findMany({
        where: {
          householdId: input.householdId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
      });
    }),
});
