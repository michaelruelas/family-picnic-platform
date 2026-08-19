import { TRPCError } from '@trpc/server';
import { router, auditedAdminProcedure } from '~/lib/trpc';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import {
  ChargeStatus,
  RefundStatus,
  RegistrationStatus,
  RSVPStatus,
  Role,
} from '~/lib/generated/enums';
import { writeAuditLog } from '~/lib/audit';
import { listAuditLogEntries } from '~/server/audit-entries';
import { createRefund, isConfigured as stripeConfigured } from '~/lib/stripe';
import { formatAmount } from '~/lib/currency';
import { sendRegistrationReceipt } from '~/lib/receipt';
import { withSerializableRetry } from '~/lib/transaction-retry';
import { randomUUID } from 'node:crypto';
import { findOrCreateUserByEmail } from '~/lib/user-identity';
import { isRelayEmail } from '~/lib/email-relay';
import {
  forfeitInputSchema,
  listChargesInputSchema,
  refundInputSchema,
} from '~/lib/schemas/payment';

const isoDate = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid ISO date');

export const adminRouter = router({
  auditLog: auditedAdminProcedure
    // FPP-50 review: accept the four new filter fields
    // (subjectType, subjectId, from, to) so the merged audit-log
    // table can be queried through tRPC. The REST endpoint under
    // /api/admin/audit-log uses the same schema.
    .input(
      z
        .object({
          eventId: z.string().trim().min(1).optional(),
          userId: z.string().trim().min(1).optional(),
          action: z.string().trim().min(1).optional(),
          subjectType: z.string().trim().min(1).optional(),
          subjectId: z.string().trim().min(1).optional(),
          from: isoDate.optional(),
          to: isoDate.optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      // Delegate to the shared helper so the tRPC proc and the
      // REST endpoint at /api/admin/audit-log stay in lockstep.
      // The helper merges AdminAuditLog and AuditLog rows and
      // stamps each entry with `source: 'admin' | 'domain'`.
      return listAuditLogEntries({
        eventId: input?.eventId,
        userId: input?.userId,
        action: input?.action,
        subjectType: input?.subjectType,
        subjectId: input?.subjectId,
        from: input?.from ? new Date(input.from) : undefined,
        to: input?.to ? new Date(input.to) : undefined,
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
          // FPP-Postmortem: exclude soft-deleted signups from the
          // admin dietary summary.
          signups: {
            where: { deletedAt: null },
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
          const { userId, created } = await findOrCreateUserByEmail(
            member.email,
            member.name,
            newHousehold.id,
          );
          if (created) results.usersCreated++;

          await prisma.rSVP.upsert({
            where: {
              eventId_userId: { eventId: input.eventId, userId },
            },
            update: {
              householdId: newHousehold.id,
              status: RSVPStatus.CONFIRMED,
              headcount: member.headcount,
              respondedAt: new Date(),
            },
            create: {
              eventId: input.eventId,
              userId,
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

  /**
   * Lists users matching a search query or returns recent users.
   * Excludes soft-deleted users.
   */
  listUsers: auditedAdminProcedure
    .input(
      z
        .object({
          q: z.string().trim().min(2).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const where = input?.q
        ? {
            deletedAt: null,
            OR: [
              { name: { contains: input.q, mode: 'insensitive' as const } },
              { email: { contains: input.q, mode: 'insensitive' as const } },
            ],
          }
        : { deletedAt: null };

      return prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          emailIsRelay: true,
          createdAt: true,
          household: { select: { id: true, name: true } },
        },
      });
    }),

  /**
   * Soft-deletes a user. The user can no longer sign in and the
   * email becomes available for re-registration.
   */
  deleteUser: auditedAdminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, deletedAt: true },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      if (user.deletedAt) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'User is already deleted',
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { deletedAt: new Date(), householdId: null },
      });

      return { deleted: true };
    }),

  /**
   * Returns a single user with full details for the edit modal.
   */
  getUser: auditedAdminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          emailIsRelay: true,
          householdId: true,
          phoneNumber: true,
          communicationPreference: true,
          smsConsent: true,
          createdAt: true,
          household: { select: { id: true, name: true } },
        },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      return user;
    }),

  /**
   * Updates a user's name, email, role, and/or household assignment.
   */
  updateUser: auditedAdminProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        name: z.string().trim().min(1).max(200),
        email: z.string().trim().email().max(320),
        role: z.nativeEnum(Role),
        phoneNumber: z.string().trim().max(30).nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, deletedAt: true },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      if (user.deletedAt) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot edit a deleted user',
        });
      }

      await prisma.user.update({
        where: { id: input.userId },
        data: {
          name: input.name,
          email: input.email,
          role: input.role,
          phoneNumber: input.phoneNumber,
          emailIsRelay: isRelayEmail(input.email),
        },
      });

      return { updated: true };
    }),

  /**
   * Lists all households for the household picker in the user edit modal.
   */
  listHouseholds: auditedAdminProcedure.query(async () => {
    return prisma.household.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }),

  /**
   * Returns a single user with all related data for the user detail page.
   */
  getUserDetail: auditedAdminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          name: true,
          email: true,
          emailIsRelay: true,
          role: true,
          householdId: true,
          phoneNumber: true,
          communicationPreference: true,
          smsConsent: true,
          onboardingCompletedAt: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          devPassword: true,
          household: {
            select: {
              id: true,
              name: true,
              members: {
                where: { deletedAt: null },
                orderBy: { name: 'asc' },
                select: { id: true, name: true, age: true, relationship: true },
              },
              users: {
                where: { deletedAt: null, id: { not: input.userId } },
                select: { id: true, name: true, email: true, role: true },
              },
            },
          },
          linkedIdentities: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              provider: true,
              providerAccountId: true,
              emailSnapshot: true,
              createdAt: true,
            },
          },
          eventAdmins: {
            select: {
              id: true,
              event: { select: { id: true, name: true, date: true } },
            },
          },
        },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      return {
        ...user,
        hasDevPassword: Boolean(user.devPassword),
        devPassword: undefined,
      };
    }),

  /**
   * Unlinks an OAuth identity from a user. Admin version skips the
   * ownership guard (the admin can unlink any identity).
   */
  unlinkIdentity: auditedAdminProcedure
    .input(z.object({ identityId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const identity = await prisma.linkedIdentity.findUnique({
        where: { id: input.identityId },
      });

      if (!identity) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Identity not found' });
      }

      await prisma.linkedIdentity.delete({ where: { id: input.identityId } });

      await writeAuditLog({
        userId: ctx.session.user.id,
        action: 'admin.user.unlinkIdentity',
        oldValue: { provider: identity.provider, identityId: identity.id, userId: identity.userId },
      });

      return { unlinked: true };
    }),

  /**
   * Clears the dev auth password for a user, preventing dev-credentials
   * sign-in without affecting OAuth sign-in.
   */
  clearDevPassword: auditedAdminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, devPassword: true },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      if (!user.devPassword) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'User does not have a dev password set',
        });
      }

      await prisma.user.update({
        where: { id: input.userId },
        data: { devPassword: null },
      });

      await writeAuditLog({
        userId: ctx.session.user.id,
        action: 'admin.user.clearDevPassword',
        oldValue: { hadPassword: true },
        newValue: { hadPassword: false },
      });

      return { cleared: true };
    }),

  /**
   * Renames a household. Used when editing a household from the user
   * detail page.
   */
  updateHouseholdName: auditedAdminProcedure
    .input(z.object({ householdId: z.string().min(1), name: z.string().trim().min(1).max(200) }))
    .mutation(async ({ input }) => {
      const household = await prisma.household.findUnique({
        where: { id: input.householdId },
        select: { id: true },
      });

      if (!household) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found' });
      }

      await prisma.household.update({
        where: { id: input.householdId },
        data: { name: input.name },
      });

      return { updated: true };
    }),

  /**
   * Soft-deletes a household roster member (HouseholdMember, not a User).
   */
  removeHouseholdMember: auditedAdminProcedure
    .input(z.object({ memberId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const member = await prisma.householdMember.findUnique({
        where: { id: input.memberId },
        select: { id: true, deletedAt: true },
      });

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }
      if (member.deletedAt) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Member is already removed',
        });
      }

      await prisma.householdMember.update({
        where: { id: input.memberId },
        data: { deletedAt: new Date() },
      });

      return { removed: true };
    }),

  /**
   * Creates a new household. Checks for duplicate names.
   */
  createHousehold: auditedAdminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(80),
      }),
    )
    .mutation(async ({ input }) => {
      const existing = await prisma.household.findFirst({
        where: {
          deletedAt: null,
          name: { equals: input.name, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A household with this name already exists',
        });
      }

      return prisma.household.create({
        data: { name: input.name },
      });
    }),

  /**
   * Lists all households with user counts and roster member counts.
   */
  listHouseholdsDetail: auditedAdminProcedure.query(async () => {
    return prisma.household.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { users: true, members: true } },
        users: {
          where: { deletedAt: null },
          select: { id: true, name: true, email: true, role: true },
        },
        members: {
          where: { deletedAt: null },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, age: true, relationship: true },
        },
      },
    });
  }),

  /**
   * Returns a single household with all related data for the detail page.
   */
  getHouseholdDetail: auditedAdminProcedure
    .input(z.object({ householdId: z.string().min(1) }))
    .query(async ({ input }) => {
      const household = await prisma.household.findUnique({
        where: { id: input.householdId },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          users: {
            where: { deletedAt: null },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, email: true, role: true },
          },
          members: {
            where: { deletedAt: null },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, age: true, relationship: true },
          },
        },
      });

      if (!household) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found' });
      }

      return household;
    }),

  /**
   * Assigns a user to a household by setting their householdId.
   */
  linkUserToHousehold: auditedAdminProcedure
    .input(z.object({ userId: z.string().min(1), householdId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, deletedAt: true },
      });
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      if (user.deletedAt) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot link a deleted user',
        });
      }

      const household = await prisma.household.findUnique({
        where: { id: input.householdId },
        select: { id: true, deletedAt: true },
      });
      if (!household || household.deletedAt) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found' });
      }

      await prisma.user.update({
        where: { id: input.userId },
        data: { householdId: input.householdId },
      });

      return { linked: true };
    }),

  /**
   * Removes a user from their household by setting householdId to null.
   */
  unlinkUserFromHousehold: auditedAdminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, householdId: true },
      });
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      if (!user.householdId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'User is not assigned to any household',
        });
      }

      await prisma.user.update({
        where: { id: input.userId },
        data: { householdId: null },
      });

      return { unlinked: true };
    }),

  /**
   * Adds a roster member to a household.
   */
  addHouseholdMember: auditedAdminProcedure
    .input(
      z.object({
        householdId: z.string().min(1),
        name: z.string().trim().min(1).max(200),
        age: z.number().int().min(0).max(150),
        relationship: z.string().trim().max(100).nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      return prisma.householdMember.create({
        data: {
          householdId: input.householdId,
          name: input.name,
          age: input.age,
          relationship: input.relationship,
        },
      });
    }),

  /**
   * Lists all charges across events (or filtered to one event) with the
   * related user, event, and refunds. The admin charges page reads from
   * this directly. Returns at most 200 rows; pagination is post-MVP.
   */
  listCharges: auditedAdminProcedure.input(listChargesInputSchema).query(async ({ input }) => {
    return prisma.charge.findMany({
      where: {
        ...(input?.eventId ? { registration: { eventId: input.eventId } } : {}),
        ...(input?.status ? { status: input.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        registration: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            event: { select: { id: true, name: true, date: true } },
          },
        },
        refunds: {
          orderBy: { createdAt: 'desc' },
          include: { refundedBy: { select: { id: true, name: true } } },
        },
      },
    });
  }),

  /**
   * Issues a Stripe refund (full or partial) for a successful charge.
   * Each refund writes an audit entry. The Refund row carries the
   * Stripe id, so retries are safe and the UI can show real state.
   *
   * Concurrency: two admins clicking refund at the same time used to
   * each read `alreadyRefunded = 0`, both call Stripe (succeeding under
   * different idempotency keys), and both overwrite `refundedCents`
   * with their own amount. Fixed by:
   *   1. Serializable transaction locks the Registration row.
   *   2. `refundedCents` is bumped with `increment: amountCents`, an
   *      atomic SQL operation that sequences concurrent admins.
   *   3. The full-refund check reads the post-increment value back so
   *      concurrent partial refunds each compute the correct threshold.
   */
  refund: auditedAdminProcedure.input(refundInputSchema).mutation(async ({ ctx, input }) => {
    if (!stripeConfigured()) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Stripe is not configured',
      });
    }

    const charge = await prisma.charge.findUnique({
      where: { id: input.chargeId },
      include: {
        registration: {
          include: {
            // Include PENDING so an in-flight refund.upsert from a
            // concurrent admin counts against the balance; otherwise
            // two admins could each see the full balance and each
            // issue a refund.
            refunds: {
              where: {
                status: { in: [RefundStatus.SUCCEEDED, RefundStatus.PENDING] },
              },
            },
          },
        },
      },
    });
    if (!charge) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Charge not found' });
    }
    if (charge.status !== ChargeStatus.SUCCEEDED) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Only succeeded charges can be refunded',
      });
    }

    const alreadyRefunded = charge.registration.refunds.reduce((sum, r) => sum + r.amountCents, 0);
    const balance = charge.amountCents - alreadyRefunded;
    if (balance <= 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Charge is already fully refunded',
      });
    }
    const refundAmount = input.amountCents ?? balance;
    if (refundAmount > balance) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Refund amount exceeds remaining balance of ${formatAmount(balance, charge.currency)}`,
      });
    }

    // Pre-generate the Refund id so it can serve as the Stripe
    // idempotency key on every retry attempt. Without this, a P2034
    // serialization failure after a successful Stripe refund call would
    // leave an orphan PENDING Refund row, because the retry would
    // create a new Refund with a different id and a fresh Stripe refund.
    // Stripe records the (idempotencyKey -> refundId) mapping for 24h,
    // so the retry's createRefund call returns the original Stripe
    // refund object instead of creating a duplicate.
    const refundId = randomUUID();

    const result = await withSerializableRetry(async () => {
      // Idempotent row creation: the upsert is a no-op on retry because
      // the row was created in the first attempt and the id is fixed.
      await prisma.refund.upsert({
        where: { id: refundId },
        create: {
          id: refundId,
          chargeId: charge.id,
          registrationId: charge.registrationId,
          amountCents: refundAmount,
          currency: charge.currency,
          status: RefundStatus.PENDING,
          reason: input.reason ?? null,
          refundedByUserId: ctx.session.user.id,
        },
        update: {},
      });

      const stripeRefund = await createRefund({
        paymentIntentId: charge.stripePaymentIntentId,
        amountCents: refundAmount,
        ...(input.reason ? { reason: input.reason } : {}),
        idempotencyKey: refundId,
      });

      // Atomic increment inside a Serializable transaction so concurrent
      // admins serialize cleanly. The full-refund status flip reads
      // the post-increment value to handle the case where multiple
      // concurrent partial refunds each compute the correct threshold.
      const [updatedRefund, postIncrement] = await prisma.$transaction(
        async (tx) => {
          const updated = await tx.refund.update({
            where: { id: refundId },
            data: {
              stripeRefundId: stripeRefund.refundId,
              status: mapStripeRefundStatus(stripeRefund.status),
            },
          });
          const reg = await tx.registration.update({
            where: { id: charge.registrationId },
            data: { refundedCents: { increment: refundAmount } },
          });
          return [updated, reg] as const;
        },
        { isolationLevel: 'Serializable' },
      );

      const isFullRefund = postIncrement.refundedCents >= charge.amountCents;
      const updatedRegistration = isFullRefund
        ? await prisma.registration.update({
            where: { id: charge.registrationId },
            data: { status: RegistrationStatus.REFUNDED },
          })
        : postIncrement;

      return { updatedRefund, updatedRegistration, isFullRefund, stripeRefund };
    });

    await writeAuditLog({
      userId: ctx.session.user.id,
      eventId: charge.registration.eventId,
      action: 'payment.refunded',
      oldValue: {
        refundedCents: alreadyRefunded - refundAmount, // pre-this-refund state
        registrationStatus: charge.registration.status,
      },
      newValue: {
        refundedCents: result.updatedRegistration.refundedCents,
        isFullRefund: result.isFullRefund,
        refundId: result.updatedRefund.id,
        stripeRefundId: result.stripeRefund.refundId,
        amountCents: refundAmount,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });

    return { refund: result.updatedRefund, registration: result.updatedRegistration };
  }),

  /**
   * Forfeit a paid registration. Money is kept by the event; no Stripe
   * refund call is made. Each forfeit writes an audit entry.
   *
   * Concurrency: two admins clicking forfeit simultaneously used to
   * both pass the read-then-write guards and both write audit entries.
   * Fixed by collapsing the read+update into a single conditional
   * update with `status: { notIn: [...] }` and checking the affected
   * row count — zero means another admin got there first.
   */
  forfeit: auditedAdminProcedure.input(forfeitInputSchema).mutation(async ({ ctx, input }) => {
    const before = await prisma.registration.findUnique({
      where: { id: input.registrationId },
    });
    if (!before) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Registration not found' });
    }

    const updateResult = await prisma.registration.updateMany({
      where: {
        id: input.registrationId,
        status: {
          notIn: [
            RegistrationStatus.FORFEITED,
            RegistrationStatus.REFUNDED,
            RegistrationStatus.CANCELLED,
          ],
        },
      },
      data: { status: RegistrationStatus.FORFEITED },
    });

    if (updateResult.count === 0) {
      const message =
        before.status === RegistrationStatus.FORFEITED
          ? 'Registration is already forfeited'
          : before.status === RegistrationStatus.REFUNDED
            ? 'Registration was refunded; use refund, not forfeit'
            : 'Registration is no longer in a forfeitable state';
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message,
      });
    }

    const after = await prisma.registration.findUniqueOrThrow({
      where: { id: before.id },
    });

    await writeAuditLog({
      userId: ctx.session.user.id,
      eventId: before.eventId,
      action: 'payment.forfeited',
      oldValue: {
        status: before.status,
        refundedCents: before.refundedCents,
      },
      newValue: {
        status: after.status,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });
    return after;
  }),

  /**
   * Re-send the receipt email for a succeeded charge. Used when the user
   * lost the original or when SendGrid was down at payment time. Writes
   * receiptSentAt on success.
   */
  resendReceipt: auditedAdminProcedure
    .input(z.object({ chargeId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const charge = await prisma.charge.findUnique({
        where: { id: input.chargeId },
        include: {
          registration: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              event: { select: { id: true, name: true, date: true } },
            },
          },
        },
      });
      if (!charge) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Charge not found' });
      }
      if (charge.status !== ChargeStatus.SUCCEEDED) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Only succeeded charges have a receipt',
        });
      }

      const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
      const result = await sendRegistrationReceipt({
        to: charge.registration.user.email,
        userName: charge.registration.user.name,
        eventName: charge.registration.event.name,
        eventDate: charge.registration.event.date,
        amountCents: charge.amountCents,
        currency: charge.currency,
        chargeId: charge.id,
        registrationId: charge.registration.id,
        receiptUrl: charge.receiptUrl,
        eventUrl: `${baseUrl}/events/${charge.registration.event.id}`,
      });

      if (result.success) {
        await prisma.charge.update({
          where: { id: charge.id },
          data: { receiptSentAt: new Date() },
        });
        await writeAuditLog({
          userId: charge.registration.user.id,
          eventId: charge.registration.eventId,
          action: 'payment.receiptResent',
          newValue: { chargeId: charge.id },
        });
      }
      return result;
    }),
});

function mapStripeRefundStatus(status: string): RefundStatus {
  switch (status) {
    case 'succeeded':
      return RefundStatus.SUCCEEDED;
    case 'pending':
    case 'requires_action':
      return RefundStatus.PENDING;
    case 'failed':
      return RefundStatus.FAILED;
    case 'canceled':
      return RefundStatus.CANCELED;
    default:
      return RefundStatus.PENDING;
  }
}
