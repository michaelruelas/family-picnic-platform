import { router, protectedProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';

export const householdRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        parentHouseholdId: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return prisma.household.create({
        data: {
          name: input.name,
          parentHouseholdId: input.parentHouseholdId,
        },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return prisma.household.findUnique({
        where: { id: input.id },
        include: {
          users: true,
          dependents: true,
          children: true,
        },
      });
    }),

  getTree: protectedProcedure.query(async () => {
    const households = await prisma.household.findMany({
      where: { deletedAt: null },
      include: {
        users: true,
        dependents: true,
        children: {
          include: {
            users: true,
            dependents: true,
          },
        },
      },
    });
    return households.filter((h) => !h.parentHouseholdId);
  }),

  addMember: protectedProcedure
    .input(
      z.object({
        householdId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      return prisma.user.update({
        where: { id: input.userId },
        data: { householdId: input.householdId },
      });
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        householdId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      return prisma.user.update({
        where: { id: input.userId },
        data: { householdId: null },
      });
    }),

  list: protectedProcedure.query(async () => {
    return prisma.household.findMany({
      where: { deletedAt: null },
      include: {
        users: true,
      },
      orderBy: { name: 'asc' },
    });
  }),
});
