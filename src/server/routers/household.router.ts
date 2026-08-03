import { router, protectedProcedure } from '~/lib/trpc';
import { TRPCError } from '@trpc/server';
import { Prisma } from '~/lib/generated/client';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import { RSVPStatus, EventStatus } from '~/lib/generated/enums';
import { householdCreateSchema, householdUpdateSchema } from '~/lib/schemas';

async function assertHouseholdNameAvailable(name: string, excludeId?: string): Promise<void> {
  const trimmed = name.trim();
  const existing = await prisma.household.findFirst({
    where: {
      deletedAt: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      name: { equals: trimmed, mode: 'insensitive' },
    },
    select: { id: true },
  });
  if (existing) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'A household with this name already exists',
    });
  }
}

function rethrowNameConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'A household with this name already exists',
    });
  }
  throw error;
}

export const householdRouter = router({
  create: protectedProcedure.input(householdCreateSchema).mutation(async ({ input }) => {
    await assertHouseholdNameAvailable(input.name);
    try {
      return await prisma.household.create({
        data: {
          name: input.name.trim(),
          parentHouseholdId: input.parentHouseholdId,
        },
      });
    } catch (error) {
      rethrowNameConflict(error);
    }
  }),

  update: protectedProcedure.input(householdUpdateSchema).mutation(async ({ ctx, input }) => {
    await assertHouseholdNameAvailable(input.name, input.id);

    // Combine ownership and update into one statement so a concurrent
    // change to the caller's householdId cannot land the rename on a
    // different row.
    const updated = await prisma.household.updateMany({
      where: {
        id: input.id,
        deletedAt: null,
        users: { some: { id: ctx.session.user.id, deletedAt: null } },
      },
      data: { name: input.name.trim() },
    });

    if (updated.count === 0) {
      // Disambiguate whether the household is missing or the caller is
      // not a member. The race window between this read and the failed
      // update does not change the outcome: a single statement already
      // determined the rename will not land here.
      const existing = await prisma.household.findUnique({
        where: { id: input.id },
        select: { id: true, deletedAt: true },
      });
      if (!existing || existing.deletedAt !== null) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found' });
      }
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You can only rename your own household',
      });
    }

    try {
      return await prisma.household.findUniqueOrThrow({ where: { id: input.id } });
    } catch (error) {
      rethrowNameConflict(error);
    }
  }),

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
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

  getCumulativeHeadcount: protectedProcedure
    .input(z.object({ householdId: z.string() }))
    .query(async ({ input }) => {
      const now = new Date();

      const rsvps = await prisma.rSVP.findMany({
        where: {
          householdId: input.householdId,
          status: RSVPStatus.CONFIRMED,
          event: {
            status: EventStatus.PUBLISHED,
            date: { gte: now },
          },
        },
        include: {
          event: {
            select: {
              id: true,
              name: true,
              date: true,
            },
          },
        },
      });

      const totalHeadcount = rsvps.reduce((sum, r) => sum + r.headcount, 0);

      const byEvent = rsvps.map((r) => ({
        eventId: r.event.id,
        eventName: r.event.name,
        eventDate: r.event.date,
        headcount: r.headcount,
      }));

      return {
        totalHeadcount,
        byEvent,
      };
    }),
});
