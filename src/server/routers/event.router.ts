import { router, protectedProcedure, auditedAdminProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import { EventStatus, AdminPermission } from '~/lib/generated/enums';
import { writeDomainAuditLog } from '~/lib/audit';

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
        registrationFeeCents: z.number().int().nonnegative().optional(),
        registrationFeeMinAge: z.number().int().min(0).max(120).optional(),
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
          registrationFeeCents: input.registrationFeeCents ?? 0,
          registrationFeeMinAge: input.registrationFeeMinAge ?? 0,
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
        registrationFeeCents: z.number().int().nonnegative().optional(),
        registrationFeeMinAge: z.number().int().min(0).max(120).optional(),
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

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
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
      z
        .object({
          status: z
            .enum([
              EventStatus.DRAFT,
              EventStatus.PUBLISHED,
              EventStatus.CLOSED,
              EventStatus.CANCELLED,
            ])
            .optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      return prisma.event.findMany({
        where: input?.status ? { status: input.status } : undefined,
        orderBy: { date: 'desc' },
      });
    }),

  publish: auditedAdminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    return prisma.event.update({
      where: { id: input.id },
      data: { status: EventStatus.PUBLISHED },
    });
  }),

  close: auditedAdminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    return prisma.event.update({
      where: { id: input.id },
      data: { status: EventStatus.CLOSED },
    });
  }),

  cancel: auditedAdminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    return prisma.event.update({
      where: { id: input.id },
      data: { status: EventStatus.CANCELLED },
    });
  }),

  listAdmins: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input }) => {
      return prisma.eventAdmin.findMany({
        where: { eventId: input.eventId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              household: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });
    }),

  addAdmin: auditedAdminProcedure
    .input(
      z.object({
        eventId: z.string(),
        userId: z.string(),
        role: z
          .enum([AdminPermission.OWNER, AdminPermission.COADMIN, AdminPermission.INVITER])
          .default(AdminPermission.COADMIN),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const created = await prisma.eventAdmin.create({
        data: {
          eventId: input.eventId,
          userId: input.userId,
          role: input.role as AdminPermission,
        },
      });

      // FPP-50: the auditedAdminProcedure middleware records the path
      // against AdminAuditLog, but without the eventId or subject. Emit
      // a domain entry keyed by event so the host assignment is
      // filterable by event, target user, and time.
      await writeDomainAuditLog({
        actorId: ctx.session.user.id,
        action: 'event.admin.add',
        subjectType: 'EventAdmin',
        subjectId: `${input.eventId}:${input.userId}`,
        payload: {
          eventId: input.eventId,
          userId: input.userId,
          role: input.role,
        },
      });

      return created;
    }),

  removeAdmin: auditedAdminProcedure
    .input(
      z.object({
        eventId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const removed = await prisma.eventAdmin.delete({
        where: {
          eventId_userId: {
            eventId: input.eventId,
            userId: input.userId,
          },
        },
      });

      await writeDomainAuditLog({
        actorId: ctx.session.user.id,
        action: 'event.admin.remove',
        subjectType: 'EventAdmin',
        subjectId: `${input.eventId}:${input.userId}`,
        payload: {
          eventId: input.eventId,
          userId: input.userId,
          role: removed.role,
        },
      });

      return removed;
    }),
});
