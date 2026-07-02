import { router, auditedAdminProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import { RSVPStatus } from '~/lib/generated/enums';

export const adminRouter = router({
  auditLog: auditedAdminProcedure
    .input(
      z
        .object({
          eventId: z.string().optional(),
          userId: z.string().optional(),
          action: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      return prisma.adminAuditLog.findMany({
        where: {
          eventId: input?.eventId,
          userId: input?.userId,
          action: input?.action ? { contains: input.action } : undefined,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          event: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    }),

  dashboard: auditedAdminProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input }) => {
      const event = await prisma.event.findUnique({
        where: { id: input.eventId },
      });

      if (!event) {
        throw new Error('Event not found');
      }

      const rsvps = await prisma.rSVP.findMany({
        where: { eventId: input.eventId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      const confirmedRsvps = rsvps.filter((r) => r.status === RSVPStatus.CONFIRMED);
      const declinedRsvps = rsvps.filter((r) => r.status === RSVPStatus.DECLINED);
      const pendingRsvps = rsvps.filter(
        (r) => r.status === RSVPStatus.PENDING || r.status === RSVPStatus.INVITED,
      );

      const totalHeadcount = confirmedRsvps.reduce((sum, r) => sum + r.headcount, 0);

      const potluckSlots = await prisma.potluckSlot.findMany({
        where: { eventId: input.eventId },
        include: {
          signups: {
            include: {
              rsvp: true,
            },
          },
        },
      });

      const foodSummary: Record<string, { category: string; items: string[] }> = {};
      for (const slot of potluckSlots) {
        const categoryEntry = foodSummary[slot.category] ?? { category: slot.category, items: [] };
        foodSummary[slot.category] = categoryEntry;
        for (const signup of slot.signups) {
          if (signup.rsvp.status === RSVPStatus.CONFIRMED) {
            categoryEntry.items.push(`${signup.dishName} (${signup.servings} servings)`);
          }
        }
      }

      return {
        event,
        rsvpSummary: {
          total: rsvps.length,
          confirmed: confirmedRsvps.length,
          declined: declinedRsvps.length,
          pending: pendingRsvps.length,
          headcount: totalHeadcount,
        },
        foodSummary: Object.values(foodSummary),
        recentRsvps: rsvps.slice(0, 10),
      };
    }),

  inviteFromPrevious: auditedAdminProcedure
    .input(
      z.object({
        fromEventId: z.string(),
        toEventId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const previousRsvps = await prisma.rSVP.findMany({
        where: {
          eventId: input.fromEventId,
          status: RSVPStatus.CONFIRMED,
        },
        include: {
          user: true,
        },
      });

      const invitations = await Promise.all(
        previousRsvps.map((rsvp) =>
          prisma.invitation.create({
            data: {
              eventId: input.toEventId,
              userId: rsvp.userId,
              householdId: rsvp.householdId,
              invitedByUserId: ctx.session.user.id,
            },
          }),
        ),
      );

      return { success: true, count: invitations.length };
    }),

  csvImport: auditedAdminProcedure
    .input(
      z.object({
        eventId: z.string(),
        households: z.array(
          z.object({
            name: z.string(),
            members: z.array(
              z.object({
                email: z.string().email(),
                name: z.string(),
                headcount: z.number().int().min(1).default(1),
              }),
            ),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      const results = {
        householdsCreated: 0,
        usersCreated: 0,
        rsvpsCreated: 0,
      };

      for (const household of input.households) {
        const newHousehold = await prisma.household.create({
          data: { name: household.name },
        });
        results.householdsCreated++;

        for (const member of household.members) {
          const existingUser = await prisma.user.findUnique({
            where: { email: member.email },
          });

          if (existingUser) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { householdId: newHousehold.id },
            });
          } else {
            await prisma.user.create({
              data: {
                email: member.email,
                name: member.name,
                householdId: newHousehold.id,
              },
            });
            results.usersCreated++;
          }

          await prisma.rSVP.create({
            data: {
              eventId: input.eventId,
              userId:
                existingUser?.id ||
                (await prisma.user.findUnique({ where: { email: member.email } }))!.id,
              householdId: newHousehold.id,
              status: RSVPStatus.CONFIRMED,
              headcount: member.headcount,
              respondedAt: new Date(),
            },
          });
          results.rsvpsCreated++;
        }
      }

      return results;
    }),
});
