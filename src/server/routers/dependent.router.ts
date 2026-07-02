import { router, protectedProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';

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
        age: z.number().int().positive().optional(),
        dietaryLabels: z.array(z.string()).default([]),
        isChild: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { id: true, householdId: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return prisma.dependent.create({
        data: {
          name: input.name,
          relationship: input.relationship,
          age: input.age,
          dietaryLabels: input.dietaryLabels,
          isChild: input.isChild,
          householdId: user.householdId || user.id,
          managedByUserId: ctx.session.user.id,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        relationship: z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'INLAW', 'COUSIN']).optional(),
        age: z.number().int().positive().nullable().optional(),
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
