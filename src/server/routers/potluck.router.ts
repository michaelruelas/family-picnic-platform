import { router, protectedProcedure, auditedAdminProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';

export const potluckRouter = router({
  createSlot: auditedAdminProcedure
    .input(
      z.object({
        eventId: z.string(),
        category: z.enum(['MAIN', 'SIDE', 'DESSERT', 'DRINK', 'OTHER']),
        name: z.string().min(1),
        slotType: z.enum(['LIMITED', 'UNLIMITED']),
        maxSignups: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return prisma.potluckSlot.create({
        data: {
          eventId: input.eventId,
          category: input.category,
          name: input.name,
          slotType: input.slotType,
          maxSignups: input.slotType === 'LIMITED' ? input.maxSignups ?? 1 : null,
        },
      });
    }),

  updateSlot: auditedAdminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        maxSignups: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return prisma.potluckSlot.update({
        where: { id },
        data,
      });
    }),

  deleteSlot: auditedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return prisma.potluckSlot.delete({
        where: { id: input.id },
      });
    }),

  listSlots: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input }) => {
      return prisma.potluckSlot.findMany({
        where: { eventId: input.eventId },
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
        orderBy: { category: 'asc' },
      });
    }),

  signup: protectedProcedure
    .input(
      z.object({
        slotId: z.string(),
        dishName: z.string().min(1),
        servings: z.number().int().min(1).default(1),
        dietaryLabels: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slot = await prisma.potluckSlot.findUnique({
        where: { id: input.slotId },
        include: { event: true },
      });

      if (!slot) {
        throw new Error('Slot not found');
      }

      if (slot.event.status !== 'PUBLISHED') {
        throw new Error('Event is not accepting potluck signups');
      }

      const rsvp = await prisma.rSVP.findUnique({
        where: {
          eventId_userId: {
            eventId: slot.eventId,
            userId: ctx.session.user.id,
          },
        },
      });

      if (!rsvp || rsvp.status !== 'CONFIRMED') {
        throw new Error('You must have a confirmed RSVP to sign up for potluck');
      }

      const existingSignup = await prisma.potluckSignup.findUnique({
        where: {
          slotId_rsvpId: {
            slotId: input.slotId,
            rsvpId: rsvp.id,
          },
        },
      });

      if (slot.slotType === 'LIMITED') {
        return prisma.$transaction(async (tx) => {
          const currentSignups = await tx.potluckSignup.count({
            where: { slotId: input.slotId },
          });
          const effectiveCount = existingSignup ? currentSignups - 1 : currentSignups;
          const maxSignups = slot.maxSignups || 0;

          if (effectiveCount >= maxSignups) {
            throw new Error('This slot is full');
          }

          if (existingSignup) {
            const updated = await tx.potluckSignup.update({
              where: { id: existingSignup.id },
              data: {
                dishName: input.dishName,
                servings: input.servings,
                dietaryLabels: input.dietaryLabels,
              },
            });
            return updated;
          }

          const created = await tx.potluckSignup.create({
            data: {
              slotId: input.slotId,
              rsvpId: rsvp.id,
              dishName: input.dishName,
              servings: input.servings,
              dietaryLabels: input.dietaryLabels,
            },
          });

          await tx.potluckSlot.update({
            where: { id: input.slotId },
            data: { currentSignups: { increment: 1 } },
          });

          return created;
        }, { isolationLevel: 'Serializable' });
      }

      if (existingSignup) {
        return prisma.potluckSignup.update({
          where: { id: existingSignup.id },
          data: {
            dishName: input.dishName,
            servings: input.servings,
            dietaryLabels: input.dietaryLabels,
          },
        });
      }

      return prisma.potluckSignup.create({
        data: {
          slotId: input.slotId,
          rsvpId: rsvp.id,
          dishName: input.dishName,
          servings: input.servings,
          dietaryLabels: input.dietaryLabels,
        },
      });
    }),

  updateSignup: protectedProcedure
    .input(
      z.object({
        slotId: z.string(),
        dishName: z.string().min(1),
        servings: z.number().int().min(1),
        dietaryLabels: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rsvp = await prisma.rSVP.findUnique({
        where: {
          eventId_userId: {
            eventId: (await prisma.potluckSlot.findUnique({ where: { id: input.slotId } }))?.eventId || '',
            userId: ctx.session.user.id,
          },
        },
      });

      if (!rsvp) {
        throw new Error('RSVP not found');
      }

      return prisma.potluckSignup.update({
        where: {
          slotId_rsvpId: {
            slotId: input.slotId,
            rsvpId: rsvp.id,
          },
        },
        data: {
          dishName: input.dishName,
          servings: input.servings,
          dietaryLabels: input.dietaryLabels,
        },
      });
    }),

  cancelSignup: protectedProcedure
    .input(z.object({ slotId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const slot = await prisma.potluckSlot.findUnique({
        where: { id: input.slotId },
      });

      if (!slot) {
        throw new Error('Slot not found');
      }

      const rsvp = await prisma.rSVP.findUnique({
        where: {
          eventId_userId: {
            eventId: slot.eventId,
            userId: ctx.session.user.id,
          },
        },
      });

      if (!rsvp) {
        throw new Error('RSVP not found');
      }

      const signup = await prisma.potluckSignup.findUnique({
        where: {
          slotId_rsvpId: {
            slotId: input.slotId,
            rsvpId: rsvp.id,
          },
        },
      });

      if (!signup) {
        throw new Error('Signup not found');
      }

      await prisma.potluckSignup.delete({
        where: { id: signup.id },
      });

      await prisma.potluckSlot.update({
        where: { id: input.slotId },
        data: { currentSignups: { decrement: 1 } },
      });

      return { success: true };
    }),

  getFoodSummary: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input }) => {
      const slots = await prisma.potluckSlot.findMany({
        where: { eventId: input.eventId },
        include: {
          signups: {
            include: {
              rsvp: true,
            },
          },
        },
      });

      const summary: Record<string, { category: string; items: string[] }> = {};

      for (const slot of slots) {
        const categoryEntry = summary[slot.category] ?? { category: slot.category, items: [] };
        summary[slot.category] = categoryEntry;
        for (const signup of slot.signups) {
          categoryEntry.items.push(
            `${signup.dishName} (${signup.servings} servings)`,
          );
        }
      }

      return Object.values(summary);
    }),
});
