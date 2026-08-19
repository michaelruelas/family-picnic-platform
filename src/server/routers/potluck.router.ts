import { router, protectedProcedure, eventAdminProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma } from '~/lib/prisma';
import { PotluckCategory, SlotType, RSVPStatus, EventStatus } from '~/lib/generated/enums';
import { writeDomainAuditLog } from '~/lib/audit';

export const potluckRouter = router({
  // FPP-104: per-event gate. A HOST with an EventAdmin row on the
  // event can create slots for their own picnic; super-admins /
  // ADMIN users pass via the platform-level admin branch.
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
    // FPP-Postmortem: the PotluckSignup_no_delete trigger blocks direct
    // DELETE on signup rows. Soft-delete every live signup for this slot
    // first (so the cascade from slot.delete has no rows left to
    // touch), then hard-delete the slot inside a transaction that opts
    // in to the bypass flag. The flag is scoped to this transaction only.
    return prisma.$transaction(async (tx) => {
      await tx.potluckSignup.updateMany({
        where: { slotId: input.id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      // SET LOCAL is scoped to the current transaction so the bypass
      // does not leak to other queries. After this transaction returns,
      // the trigger is back to blocking direct DELETEs.
      await tx.$executeRawUnsafe("SET LOCAL app.potluck_signup_allow_hard_delete = 'true'");
      return tx.potluckSlot.delete({
        where: { id: input.id },
      });
    });
  }),

  listSlots: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input }) => {
      return prisma.potluckSlot.findMany({
        where: { eventId: input.eventId },
        include: {
          // FPP-Postmortem: filter out soft-deleted signups so
          // cancelled claims don't appear on the potluck list.
          signups: {
            where: { deletedAt: null },
            include: {
              // FPP-127: surface the household name as the primary
              // identity handle on every potluck claim. The RSVP
              // table does not hold a household relation, so we
              // walk through the user. The UI reads `household.name`
              // so a household of five still reads as one claim,
              // not five.
              rsvp: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      household: { select: { id: true, name: true } },
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
   * `SlotList` component consumes. Used by the Potluck tab inside
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
            // FPP-Postmortem: also exclude soft-deleted signups.
            where: { deletedAt: null, rsvp: { status: RSVPStatus.CONFIRMED } },
            orderBy: { id: 'asc' },
            include: {
              rsvp: {
                select: {
                  userId: true,
                  // FPP-127: pull the household name through the
                  // user relation (RSVP does not have its own
                  // household FK) so the client can label claims by
                  // household, not by individual user.
                  user: {
                    select: {
                      id: true,
                      name: true,
                      household: { select: { id: true, name: true } },
                    },
                  },
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
            householdName: s.rsvp.user.household?.name ?? null,
          },
        })),
      }));
    }),

  signup: protectedProcedure
    .input(
      z.object({
        slotId: z.string(),
        dishName: z.string().trim().default(''),
        servings: z.number().int().min(1).default(1),
        dietaryLabels: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Multi-claim per RSVP: this procedure always CREATES a new
      // PotluckSignup row. The same household can sign up multiple
      // times on one slot with different dish names (e.g. "Other:
      // Cups" and "Other: Napkins"). To edit or drop an existing
      // signup, use `updateSignup` / `cancelSignup` with the
      // signup's `id`.
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

      if (slot.slotType === SlotType.LIMITED) {
        // Serializable transaction so the count + create + counter
        // increment stay atomic. Without this two concurrent signups
        // on a near-full LIMITED slot could both pass the capacity
        // check and exceed `maxSignups`.
        return prisma.$transaction(
          async (tx) => {
            // FPP-Postmortem: only live (non soft-deleted) signups
            // count against the LIMITED-slot capacity.
            const currentSignups = await tx.potluckSignup.count({
              where: { slotId: input.slotId, deletedAt: null },
            });
            const maxSignups = slot.maxSignups || 0;

            if (currentSignups >= maxSignups) {
              throw new Error('This slot is full');
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

            // FPP-50: surface the new dish on the audit log so the
            // dish list is traceable per household.
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

      // FPP-50 review: wrap the UNLIMITED create path in a
      // transaction so the audit log row is atomic with the signup
      // write. UNLIMITED slots have no capacity race so the default
      // isolation level is fine.
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
        signupId: z.string(),
        dishName: z.string().trim().default(''),
        servings: z.number().int().min(1),
        dietaryLabels: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Multi-claim: edits target a single signup row identified by
      // its `id`. The caller must own the signup (via their RSVP).
      // FPP-Postmortem: refuse to update a soft-deleted row so the
      // edit path can't accidentally resurrect a cancelled signup.
      const signup = await prisma.potluckSignup.findUnique({
        where: { id: input.signupId },
        include: { slot: true },
      });
      if (!signup || signup.deletedAt !== null) {
        throw new Error('Signup not found');
      }

      const rsvp = await prisma.rSVP.findUnique({
        where: {
          eventId_userId: {
            eventId: signup.slot.eventId,
            userId: ctx.session.user.id,
          },
        },
        select: { id: true },
      });

      if (!rsvp || rsvp.id !== signup.rsvpId) {
        throw new Error('Signup not found');
      }

      // FPP-50 review: wrap the update + audit write in a transaction
      // so the audit log row is atomic with the signup write.
      return prisma.$transaction(async (tx) => {
        // FPP-Postmortem: a soft-deleted row would be filtered out
        // by the before-update trigger, but skip it here for a clear
        // audit-log `before` payload (null means nothing to log).
        const before = await tx.potluckSignup.findUnique({
          where: { id: input.signupId },
        });

        if (!before || before.deletedAt !== null) {
          throw new Error('Signup not found');
        }

        const updated = await tx.potluckSignup.update({
          where: { id: input.signupId },
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
              slotId: signup.slotId,
              eventId: signup.slot.eventId,
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
    .input(z.object({ signupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Multi-claim: cancellation targets a single signup row by its
      // `id`. The caller must own the signup (via their RSVP).
      // FPP-Postmortem: filter `deletedAt: null` so an already-cancelled
      // signup returns 404 instead of being silently re-cancelled
      // (which would double-decrement the slot counter).
      const signup = await prisma.potluckSignup.findUnique({
        where: { id: input.signupId },
        include: { slot: true },
      });

      if (!signup || signup.deletedAt !== null) {
        throw new Error('Signup not found');
      }

      const rsvp = await prisma.rSVP.findUnique({
        where: {
          eventId_userId: {
            eventId: signup.slot.eventId,
            userId: ctx.session.user.id,
          },
        },
        select: { id: true },
      });

      if (!rsvp || rsvp.id !== signup.rsvpId) {
        throw new Error('Signup not found');
      }

      // FPP-Postmortem: soft-delete (set deletedAt) instead of hard
      // delete. The DB trigger `PotluckSignup_no_delete` raises on any
      // direct DELETE statement; legitimate cancel paths mark the row.
      // Counter decrement + audit write remain in the same transaction
      // so all three stay atomic.
      await prisma.$transaction(async (tx) => {
        await tx.potluckSignup.update({
          where: { id: signup.id },
          data: { deletedAt: new Date() },
        });

        await tx.potluckSlot.update({
          where: { id: signup.slotId },
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
              slotId: signup.slotId,
              eventId: signup.slot.eventId,
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
      // FPP-Postmortem: filter out soft-deleted signups so the
      // "my signups" summary only lists live claims.
      return prisma.potluckSignup.findMany({
        where: { rsvpId: rsvp.id, deletedAt: null },
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
          // FPP-Postmortem: exclude soft-deleted signups from the
          // food summary so cancelled dishes don't appear.
          signups: {
            where: { deletedAt: null },
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
