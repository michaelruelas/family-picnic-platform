import { router, protectedProcedure, eventAdminProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma } from '~/lib/prisma';
import { PotluckCategory, SlotType, RSVPStatus, EventStatus } from '~/lib/generated/enums';
import { writeDomainAuditLog } from '~/lib/audit';

export const potluckRouter = router({
  // FPP-104: per-event gate. A HOST with an EventAdmin row on the
  // event can create slots for their own picnic; super-admins /
  // ADMIN_ADULT users pass via the platform-level admin branch.
  // Aligns the tRPC proc with the per-event REST gate the admin UI
  // already relies on.
  createSlot: eventAdminProcedure(
    z.object({
      eventId: z.string(),
      category: z.enum([
        PotluckCategory.MAIN,
        PotluckCategory.SIDE,
        PotluckCategory.DESSERT,
        PotluckCategory.DRINK,
        PotluckCategory.OTHER,
      ]),
      // FPP-54: slot name is optional. Admins may leave it blank to
      // open a category slot with no specific dish. An empty / whitespace
      // string is normalised to NULL by the resolver.
      name: z
        .string()
        .trim()
        .max(120)
        .optional()
        .nullable()
        .transform((v) => (v == null || v === '' ? null : v)),
      slotType: z.enum([SlotType.LIMITED, SlotType.UNLIMITED]),
      maxSignups: z.number().int().positive().optional(),
    }),
    (input) => input.eventId,
  ).mutation(async ({ input }) => {
    return prisma.potluckSlot.create({
      data: {
        eventId: input.eventId,
        category: input.category,
        name: input.name,
        slotType: input.slotType,
        maxSignups: input.slotType === 'LIMITED' ? (input.maxSignups ?? 1) : null,
      },
    });
  }),

  // FPP-104: per-event gate. The input is the slot id, not the
  // event id, so we look the slot up first and run the gate on its
  // parent event. A HOST can edit slots on their own event; a
  // non-event-admin attempting to PATCH a foreign event's slot
  // gets FORBIDDEN. Mirrors the REST PATCH route's
  // `requireEventAdminApi(slot.eventId)` flow.
  updateSlot: eventAdminProcedure(
    z.object({
      id: z.string(),
      // FPP-54: empty / whitespace clears the name (NULL).
      name: z
        .string()
        .trim()
        .max(120)
        .optional()
        .nullable()
        .transform((v) => (v === undefined ? undefined : v == null || v === '' ? null : v)),
      maxSignups: z.number().int().positive().optional(),
    }),
    async (input) => {
      const slot = await prisma.potluckSlot.findUnique({
        where: { id: input.id },
        select: { eventId: true },
      });
      if (!slot) {
        // FPP-104 review: throw a tRPC-shaped NOT_FOUND so the
        // client surfaces a real protocol error. A plain Error
        // would land as INTERNAL_SERVER_ERROR at the tRPC layer.
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Slot not found' });
      }
      return slot.eventId;
    },
  ).mutation(async ({ input }) => {
    const { id, ...data } = input;
    return prisma.potluckSlot.update({
      where: { id },
      data,
    });
  }),

  // FPP-104: per-event gate, same lookup shape as `updateSlot`.
  deleteSlot: eventAdminProcedure(z.object({ id: z.string() }), async (input) => {
    const slot = await prisma.potluckSlot.findUnique({
      where: { id: input.id },
      select: { eventId: true },
    });
    if (!slot) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Slot not found' });
    }
    return slot.eventId;
  }).mutation(async ({ input }) => {
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

  /**
   * Returns the event's slots in the EventSlot shape the client
   * `SlotList` component consumes. Used by the Dishes tab inside
   * the RSVP bottom sheet to mount the same UI as the standalone
   * /events/[id]/potluck page without going through the tRPC
   * `listSlots` route which returns the raw Prisma rows. Excludes
   * signups from non-confirmed RSVPs so the dish list matches the
   * public potluck overview.
   */
  getSlotsForEvent: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input }) => {
      const slots = await prisma.potluckSlot.findMany({
        where: { eventId: input.eventId },
        orderBy: { category: 'asc' },
        include: {
          signups: {
            where: { rsvp: { status: RSVPStatus.CONFIRMED } },
            orderBy: { id: 'asc' },
            include: {
              rsvp: {
                select: {
                  userId: true,
                  user: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      });

      return slots.map((slot) => ({
        id: slot.id,
        name: slot.name,
        category: slot.category,
        slotType: slot.slotType,
        maxSignups: slot.maxSignups,
        currentSignups: slot.currentSignups,
        signups: slot.signups.map((s) => ({
          id: s.id,
          dishName: s.dishName,
          servings: s.servings,
          dietaryLabels: s.dietaryLabels,
          rsvp: {
            userId: s.rsvp.userId,
            user: s.rsvp.user,
          },
        })),
      }));
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

      if (slot.event.status !== EventStatus.PUBLISHED) {
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

      if (!rsvp || rsvp.status !== RSVPStatus.CONFIRMED) {
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

      if (slot.slotType === SlotType.LIMITED) {
        return prisma.$transaction(
          async (tx) => {
            const currentSignups = await tx.potluckSignup.count({
              where: { slotId: input.slotId },
            });
            const effectiveCount = existingSignup ? currentSignups - 1 : currentSignups;
            const maxSignups = slot.maxSignups || 0;

            if (effectiveCount >= maxSignups) {
              throw new Error('This slot is full');
            }

            if (existingSignup) {
              const before = {
                dishName: existingSignup.dishName,
                servings: existingSignup.servings,
                dietaryLabels: existingSignup.dietaryLabels,
              };
              const updated = await tx.potluckSignup.update({
                where: { id: existingSignup.id },
                data: {
                  dishName: input.dishName,
                  servings: input.servings,
                  dietaryLabels: input.dietaryLabels,
                },
              });
              // FPP-50: surface signup edits on the audit log so the
              // dish list is traceable per household.
              await writeDomainAuditLog(
                {
                  actorId: ctx.session.user.id,
                  action: 'potluck.signup.update',
                  subjectType: 'PotluckSignup',
                  subjectId: updated.id,
                  payload: {
                    slotId: input.slotId,
                    eventId: slot.eventId,
                    before,
                    after: {
                      dishName: input.dishName,
                      servings: input.servings,
                      dietaryLabels: input.dietaryLabels,
                    },
                  },
                },
                tx,
              );
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

            await writeDomainAuditLog(
              {
                actorId: ctx.session.user.id,
                action: 'potluck.signup.create',
                subjectType: 'PotluckSignup',
                subjectId: created.id,
                payload: {
                  slotId: input.slotId,
                  eventId: slot.eventId,
                  dishName: input.dishName,
                  servings: input.servings,
                  dietaryLabels: input.dietaryLabels,
                },
              },
              tx,
            );

            return created;
          },
          { isolationLevel: 'Serializable' },
        );
      }

      if (existingSignup) {
        // FPP-50 review: wrap the UNLIMITED update path in a
        // transaction so the audit log row is atomic with the signup
        // write. No Serializable isolation needed because UNLIMITED
        // slots have no capacity race; the default isolation level
        // is fine.
        return prisma.$transaction(async (tx) => {
          const before = {
            dishName: existingSignup.dishName,
            servings: existingSignup.servings,
            dietaryLabels: existingSignup.dietaryLabels,
          };
          const updated = await tx.potluckSignup.update({
            where: { id: existingSignup.id },
            data: {
              dishName: input.dishName,
              servings: input.servings,
              dietaryLabels: input.dietaryLabels,
            },
          });
          await writeDomainAuditLog(
            {
              actorId: ctx.session.user.id,
              action: 'potluck.signup.update',
              subjectType: 'PotluckSignup',
              subjectId: updated.id,
              payload: {
                slotId: input.slotId,
                eventId: slot.eventId,
                before,
                after: {
                  dishName: input.dishName,
                  servings: input.servings,
                  dietaryLabels: input.dietaryLabels,
                },
              },
            },
            tx,
          );
          return updated;
        });
      }

      // FPP-50 review: wrap the UNLIMITED create path in a
      // transaction so the audit log row is atomic with the signup
      // write.
      return prisma.$transaction(async (tx) => {
        const created = await tx.potluckSignup.create({
          data: {
            slotId: input.slotId,
            rsvpId: rsvp.id,
            dishName: input.dishName,
            servings: input.servings,
            dietaryLabels: input.dietaryLabels,
          },
        });
        await writeDomainAuditLog(
          {
            actorId: ctx.session.user.id,
            action: 'potluck.signup.create',
            subjectType: 'PotluckSignup',
            subjectId: created.id,
            payload: {
              slotId: input.slotId,
              eventId: slot.eventId,
              dishName: input.dishName,
              servings: input.servings,
              dietaryLabels: input.dietaryLabels,
            },
          },
          tx,
        );
        return created;
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
      const slot = await prisma.potluckSlot.findUnique({ where: { id: input.slotId } });
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

      // FPP-50 review: wrap the update + audit write in a transaction
      // so the audit log row is atomic with the signup write.
      return prisma.$transaction(async (tx) => {
        const before = await tx.potluckSignup.findUnique({
          where: {
            slotId_rsvpId: {
              slotId: input.slotId,
              rsvpId: rsvp.id,
            },
          },
        });

        const updated = await tx.potluckSignup.update({
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

        // FPP-50: log the dish edit so changes show up on the audit log.
        await writeDomainAuditLog(
          {
            actorId: ctx.session.user.id,
            action: 'potluck.signup.update',
            subjectType: 'PotluckSignup',
            subjectId: updated.id,
            payload: {
              slotId: input.slotId,
              eventId: slot.eventId,
              before: before
                ? {
                    dishName: before.dishName,
                    servings: before.servings,
                    dietaryLabels: before.dietaryLabels,
                  }
                : null,
              after: {
                dishName: input.dishName,
                servings: input.servings,
                dietaryLabels: input.dietaryLabels,
              },
            },
          },
          tx,
        );

        return updated;
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

      // FPP-50 review: wrap the delete + counter decrement + audit
      // write in a transaction so the audit log row is atomic with
      // the signup removal.
      await prisma.$transaction(async (tx) => {
        await tx.potluckSignup.delete({
          where: { id: signup.id },
        });

        await tx.potluckSlot.update({
          where: { id: input.slotId },
          data: { currentSignups: { decrement: 1 } },
        });

        // FPP-50: log the cancellation so dropped dishes are visible on
        // the audit log alongside the create/update entries.
        await writeDomainAuditLog(
          {
            actorId: ctx.session.user.id,
            action: 'potluck.signup.cancel',
            subjectType: 'PotluckSignup',
            subjectId: signup.id,
            payload: {
              slotId: input.slotId,
              eventId: slot.eventId,
              dishName: signup.dishName,
              servings: signup.servings,
            },
          },
          tx,
        );
      });

      return { success: true };
    }),

  /**
   * Returns the caller's potluck signups for an event, including the
   * slot and rsvp ids needed by the client to render the "my slots"
   * summary and to call cancel/update. Empty array when the caller has
   * no RSVP or no signups. Ordered by claimedAt so the "yours" list
   * reads in the order the user claimed dishes.
   */
  getMySignups: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rsvp = await prisma.rSVP.findUnique({
        where: {
          eventId_userId: {
            eventId: input.eventId,
            userId: ctx.session.user.id,
          },
        },
        select: { id: true },
      });
      if (!rsvp) {
        return [];
      }
      return prisma.potluckSignup.findMany({
        where: { rsvpId: rsvp.id },
        orderBy: { claimedAt: 'asc' },
        select: {
          id: true,
          slotId: true,
          dishName: true,
          servings: true,
          dietaryLabels: true,
          claimedAt: true,
          slot: {
            select: {
              id: true,
              name: true,
              category: true,
              slotType: true,
            },
          },
        },
      });
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
          categoryEntry.items.push(`${signup.dishName} (${signup.servings} servings)`);
        }
      }

      return Object.values(summary);
    }),
});
