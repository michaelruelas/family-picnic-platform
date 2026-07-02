import { router, protectedProcedure, auditedAdminProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import { EventStatus } from '~/lib/generated/enums';

export const eventRouter = router({
  create: auditedAdminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        date: z.string().datetime(),
        location: z.string().min(1),
        description: z.string(),
        rsvpDeadline: z.string().datetime().optional(),
        maxCapacity: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return prisma.event.create({
        data: {
          name: input.name,
          date: new Date(input.date),
          location: input.location,
          description: input.description,
          rsvpDeadline: input.rsvpDeadline ? new Date(input.rsvpDeadline) : null,
          maxCapacity: input.maxCapacity,
          status: EventStatus.DRAFT,
        },
      });
    }),

  update: auditedAdminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        date: z.string().datetime().optional(),
        location: z.string().min(1).optional(),
        description: z.string().optional(),
        rsvpDeadline: z.string().datetime().optional(),
        maxCapacity: z.number().int().positive().optional(),
        mapImageUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = { ...data };
      if (data.date) updateData.date = new Date(data.date);
      if (data.rsvpDeadline) updateData.rsvpDeadline = new Date(data.rsvpDeadline);
      return prisma.event.update({
        where: { id },
        data: updateData,
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return prisma.event.findUnique({
        where: { id: input.id },
        include: {
          potluckSlots: {
            include: {
              signups: {
                include: {
                  rsvp: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          rsvps: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    }),

  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED']).optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      return prisma.event.findMany({
        where: input?.status ? { status: input.status } : undefined,
        orderBy: { date: 'desc' },
      });
    }),

  publish: auditedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return prisma.event.update({
        where: { id: input.id },
        data: { status: EventStatus.PUBLISHED },
      });
    }),

  close: auditedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return prisma.event.update({
        where: { id: input.id },
        data: { status: EventStatus.CLOSED },
      });
    }),

  cancel: auditedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return prisma.event.update({
        where: { id: input.id },
        data: { status: EventStatus.CANCELLED },
      });
    }),
});
