import {
  router,
  procedure,
  protectedProcedure,
  auditedAdminProcedure,
  eventAdminProcedure,
} from '~/lib/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import { EventStatus, AdminPermission } from '~/lib/generated/enums';
import { writeDomainAuditLog, writeAuditLog } from '~/lib/audit';
import { stampHostRole, unassignHostRole, canAccessEvent } from '~/lib/event-access';
import { isAdminRole } from '~/lib/auth';
import { toEventCreateData } from '~/lib/event-data';
import { getLatestPublishedEvent } from '~/lib/events';

export const eventRouter = router({
  // FPP-148: navbar "Event" link target. Public so guests see it
  // before they sign in. Delegates to getLatestPublishedEvent so the
  // helper + procedure stay in lockstep and the helper can be unit
  // tested in isolation.
  getLatest: procedure.query(() => getLatestPublishedEvent()),

  create: auditedAdminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        date: z.string().datetime(),
        location: z.string().min(1),
        // FPP-145: optional custom display name. Distinct from
        // `location` (the Google Places formatted address).
        customLocationName: z.string().optional().nullable(),
        lat: z.number().optional().nullable(),
        lng: z.number().optional().nullable(),
        placeId: z.string().optional().nullable(),
        description: z.string(),
        additionalInfo: z.string().optional().nullable(),
        rsvpDeadline: z.string().datetime().optional(),
        maxCapacity: z.number().int().positive().optional(),
        mapImageUrl: z.string().optional(),
        featuredImageUrl: z.string().optional(),
        currency: z.string().optional(),
        registrationFeeCents: z.number().int().nonnegative().optional(),
        registrationFeeMinAge: z.number().int().min(0).max(120).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      // FPP-60: `toEventCreateData` collapses `""` (and any other
      // empty URL input) to null via `||`, so an empty string
      // arrives in the DB as NULL. The update path keeps an
      // explicit `=== ''` check at this layer because it operates
      // on the partial-update shape; create does not need one.
      return prisma.event.create({
        data: {
          ...toEventCreateData(input),
          status: EventStatus.DRAFT,
        },
      });
    }),

  // FPP-65 / QUB-13.1: per-event gated. A HOST assigned to the event
  // can call update; so can super-admin/ADMIN. Other callers
  // get FORBIDDEN.
  update: eventAdminProcedure(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      date: z.string().datetime().optional(),
      location: z.string().min(1).optional(),
      // FPP-145: optional host-defined display name. Empty string
      // clears it; omit leaves the existing value untouched.
      customLocationName: z.string().min(1).optional().nullable(),
      lat: z.number().optional().nullable(),
      lng: z.number().optional().nullable(),
      placeId: z.string().optional().nullable(),
      description: z.string().optional(),
      additionalInfo: z.string().optional().nullable(),
      rsvpDeadline: z.string().datetime().optional(),
      maxCapacity: z.number().int().positive().optional(),
      mapImageUrl: z.string().optional(),
      featuredImageUrl: z.string().optional(),
      currency: z.string().optional(),
      registrationFeeCents: z.number().int().nonnegative().optional(),
      registrationFeeMinAge: z.number().int().min(0).max(120).optional(),
    }),
    (input) => input.id,
  ).mutation(async ({ input }) => {
    const { id, ...data } = input;
    const updateData: Record<string, unknown> = { ...data };
    if (data.date) updateData.date = new Date(data.date);
    if (data.rsvpDeadline) updateData.rsvpDeadline = new Date(data.rsvpDeadline);
    // FPP-60: allow clearing the featured image by sending an
    // empty string through the optional update field.
    if (data.featuredImageUrl !== undefined && data.featuredImageUrl === '') {
      updateData.featuredImageUrl = null;
    }
    if (data.additionalInfo !== undefined && data.additionalInfo === '') {
      updateData.additionalInfo = null;
    }
    // FPP-145: same empty-string-clears-the-field pattern for
    // customLocationName so the host can drop back to the resolved
    // Google address by simply editing the input empty.
    if (data.customLocationName !== undefined && data.customLocationName === '') {
      updateData.customLocationName = null;
    }
    return prisma.event.update({
      where: { id },
      data: updateData,
    });
  }),

  // FPP-68 / QUB-12: a regular user must never see an archived event
  // by id, even if they know the cuid. Super-admins and HOST users
  // with an EventAdmin row for the event still get the row so the
  // admin past-events page can drill down into an archived event.
  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const event = await prisma.event.findUnique({
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

    if (!event) {
      return event;
    }

    if (!event.archivedAt) {
      return event;
    }

    // Archived row: only surface it to admins (platform-level or
    // HOST with an EventAdmin row). Anyone else gets NOT_FOUND so the
    // event effectively disappears from their view.
    const allowed =
      isAdminRole(ctx.session?.user?.role) || (await canAccessEvent(ctx.session, event.id));
    if (!allowed) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    return event;
  }),

  // FPP-68 / QUB-12: archived rows are hidden from non-admin callers
  // so the public event listing never shows retired gatherings. Admins
  // (platform-level) still see every event so the admin past-events
  // page can drive off the same procedure if it ever needs to.
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
    .query(async ({ ctx, input }) => {
      const showArchived = isAdminRole(ctx.session?.user?.role);
      const where = {
        ...(input?.status ? { status: input.status } : {}),
        ...(showArchived ? {} : { archivedAt: null }),
      };
      return prisma.event.findMany({
        where,
        orderBy: { date: 'desc' },
      });
    }),

  publish: eventAdminProcedure(z.object({ id: z.string() }), (input) => input.id).mutation(
    async ({ input }) => {
      return prisma.event.update({
        where: { id: input.id },
        data: { status: EventStatus.PUBLISHED },
      });
    },
  ),

  close: eventAdminProcedure(z.object({ id: z.string() }), (input) => input.id).mutation(
    async ({ input }) => {
      return prisma.event.update({
        where: { id: input.id },
        data: { status: EventStatus.CLOSED },
      });
    },
  ),

  // FPP-70: re-open is the inverse of close (CLOSED -> PUBLISHED).
  // The transition guard rejects every other source status — an
  // open, draft, cancelled, or future ARCHIVED (QUB-12) event. The
  // auditLog middleware records the mutation as `event.reopen`; no
  // re-notification is sent to households that already RSVPed.
  reopen: eventAdminProcedure(z.object({ id: z.string() }), (input) => input.id).mutation(
    async ({ input }) => {
      const event = await prisma.event.findUnique({ where: { id: input.id } });

      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      if (event.status !== EventStatus.CLOSED) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only CLOSED events can be re-opened',
        });
      }

      return prisma.event.update({
        where: { id: input.id },
        data: { status: EventStatus.PUBLISHED },
      });
    },
  ),

  cancel: eventAdminProcedure(z.object({ id: z.string() }), (input) => input.id).mutation(
    async ({ input }) => {
      return prisma.event.update({
        where: { id: input.id },
        data: { status: EventStatus.CANCELLED },
      });
    },
  ),

  // FPP-68 / QUB-12: archive stamps `archivedAt` so the event
  // leaves the active admin list and surfaces under "Past events".
  // Distinct from `status` — an event can be archived regardless
  // of its current lifecycle state (DRAFT, PUBLISHED, CLOSED, or
  // CANCELLED). Idempotent: archiving an already-archived event
  // is a no-op (the existing timestamp is preserved).
  //
  // QUB-26.1: the transition is recorded in the admin audit log
  // with old/new archived-at values so the audit viewer can show
  // "archived by <admin> at <time>" without a separate column.
  // `audit: false` skips the generic `action: path` audit that the
  // eventAdminProcedure middleware would otherwise stack on top —
  // the diff entry below is the only audit row for this mutation.
  archive: eventAdminProcedure(z.object({ id: z.string() }), (input) => input.id, {
    audit: false,
  }).mutation(async ({ ctx, input }) => {
    const event = await prisma.event.findUnique({ where: { id: input.id } });

    if (!event) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    // Idempotent guard: do not rewrite `archivedAt` on a row that
    // is already archived so the original archive timestamp
    // survives a re-click.
    if (event.archivedAt) {
      return event;
    }

    const updated = await prisma.event.update({
      where: { id: input.id },
      data: { archivedAt: new Date() },
    });

    await writeAuditLog({
      userId: ctx.session.user.id,
      eventId: event.id,
      action: 'event.archive',
      oldValue: { archivedAt: null },
      newValue: { archivedAt: updated.archivedAt },
    });

    return updated;
  }),

  // FPP-68 / QUB-12: unarchive clears `archivedAt` so the event
  // returns to the active admin list. Idempotent: unarchiving a
  // non-archived event is a no-op. Same QUB-26.1 audit shape as
  // archive; `audit: false` for the same reason.
  unarchive: eventAdminProcedure(z.object({ id: z.string() }), (input) => input.id, {
    audit: false,
  }).mutation(async ({ ctx, input }) => {
    const event = await prisma.event.findUnique({ where: { id: input.id } });

    if (!event) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    if (!event.archivedAt) {
      return event;
    }

    const updated = await prisma.event.update({
      where: { id: input.id },
      data: { archivedAt: null },
    });

    await writeAuditLog({
      userId: ctx.session.user.id,
      eventId: event.id,
      action: 'event.unarchive',
      oldValue: { archivedAt: event.archivedAt },
      newValue: { archivedAt: null },
    });

    return updated;
  }),

  // FPP-65 / QUB-13.1: per-event gated. Same pattern as
  // update/publish/close/cancel — super-admin or HOST with an
  // EventAdmin row for the event can read the admin roster.
  listAdmins: eventAdminProcedure(
    z.object({ eventId: z.string() }),
    (input) => input.eventId,
  ).query(async ({ input }) => {
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

  // FPP-65 / QUB-13.2: super-admin (or HOST who already has an
  // EventAdmin row for the event) assigns a host. Defaults to
  // OWNER (host) so the multi-select picker on the admin UI picks
  // the right role without sending one. The role stamp is delegated
  // to the shared `stampHostRole` helper so REST and tRPC stay in
  // lockstep.
  addAdmin: eventAdminProcedure(
    z.object({
      eventId: z.string(),
      userId: z.string(),
      role: z
        .enum([AdminPermission.OWNER, AdminPermission.COADMIN, AdminPermission.INVITER])
        .default(AdminPermission.OWNER),
    }),
    (input) => input.eventId,
  ).mutation(async ({ ctx, input }) => {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.eventAdmin.create({
        data: {
          eventId: input.eventId,
          userId: input.userId,
          role: input.role as AdminPermission,
        },
      });

      if (input.role === AdminPermission.OWNER) {
        await stampHostRole([input.userId], tx);
      }

      return row;
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

  // FPP-65 / QUB-13.1 + QUB-13.2: per-event gated. After the row
  // is removed, run `unassignHostRole` so a user who loses their
  // last OWNER permission row is demoted back to ADULT.
  removeAdmin: eventAdminProcedure(
    z.object({
      eventId: z.string(),
      userId: z.string(),
    }),
    (input) => input.eventId,
  ).mutation(async ({ ctx, input }) => {
    const removed = await prisma.$transaction(async (tx) => {
      const row = await tx.eventAdmin.delete({
        where: {
          eventId_userId: {
            eventId: input.eventId,
            userId: input.userId,
          },
        },
      });

      // Un-stamp only matters when the removed row was an OWNER —
      // removing a COADMIN or INVITER permission does not affect
      // the user's host status.
      if (row.role === AdminPermission.OWNER) {
        await unassignHostRole(input.userId, tx);
      }

      return row;
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
        demoted: removed.role === AdminPermission.OWNER,
      },
    });

    return removed;
  }),
});
