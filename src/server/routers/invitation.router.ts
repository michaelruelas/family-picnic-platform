import { router, auditedAdminProcedure, procedure } from '~/lib/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '~/lib/prisma';
import {
  InvitationStatus,
  CommunicationStatus,
  CommunicationChannel,
  CommunicationLogKind,
} from '~/lib/generated/enums';
import {
  generateInvitationToken,
  getInvitationExpiry,
  buildInvitationUrl,
} from '~/lib/invitation-token';
import {
  checkAdminBroadcastRateLimit,
  checkRecipientGroupRateLimit,
  checkAllRecipientRateLimits,
  rateLimitError,
} from '~/lib/rate-limit';
import { writeAuditLog } from '~/lib/audit';

export const invitationRouter = router({
  send: auditedAdminProcedure
    .input(
      z.object({
        eventId: z.string(),
        householdId: z.string().optional(),
        userId: z.string().optional(),
        channel: z.enum(['EMAIL', 'SMS']).default('EMAIL'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.householdId && !input.userId) {
        throw new Error('Either householdId or userId must be provided');
      }

      const adminBroadcastResult = await checkAdminBroadcastRateLimit(ctx.session.user.id);
      if (!adminBroadcastResult.allowed) {
        rateLimitError(adminBroadcastResult, 'invitations per hour');
      }

      const recipientGroupResult = await checkRecipientGroupRateLimit(
        ctx.session.user.id,
        input.eventId,
        'HOUSEHOLD',
        input.householdId ? [input.householdId] : undefined,
      );
      if (!recipientGroupResult.allowed) {
        rateLimitError(recipientGroupResult, 'invitations to same household');
      }

      const token = generateInvitationToken();
      const expiresAt = getInvitationExpiry(30);
      const invitation = await prisma.invitation.create({
        data: {
          eventId: input.eventId,
          householdId: input.householdId,
          userId: input.userId,
          status: InvitationStatus.PENDING,
          invitedByUserId: ctx.session.user.id,
          token,
          expiresAt,
        },
      });

      let recipientUserIds: string[] = [];
      if (input.userId) {
        recipientUserIds = [input.userId];
      } else if (input.householdId) {
        const users = await prisma.user.findMany({
          where: { householdId: input.householdId },
          select: { id: true },
        });
        recipientUserIds = users.map((u) => u.id);
      }

      const recipientLimitResults = await checkAllRecipientRateLimits(recipientUserIds);
      const blockedRecipients = recipientLimitResults.filter((r) => !r.allowed);
      if (blockedRecipients.length > 0) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `${blockedRecipients.length} recipient(s) have exceeded the daily message limit and cannot receive invitations today.`,
        });
      }

      await Promise.all(
        recipientUserIds.map((recipientUserId) =>
          prisma.communicationLog.create({
            data: {
              eventId: input.eventId,
              sentByUserId: ctx.session.user.id,
              recipientUserId,
              channel: input.channel as CommunicationChannel,
              status: CommunicationStatus.QUEUED,
              // FPP-88 review: tag the row so the send pipeline
              // can branch on `kind` instead of sniffing `body`.
              // Without this, an invitation URL and a decline
              // note are indistinguishable in the queue.
              kind: CommunicationLogKind.INVITATION,
              // FPP-88: stash the wizard landing page URL on the log
              // row so the email/SMS send pipeline (and any future
              // "view invitations" page) can read it. The actual
              // send happens in the communications pipeline; this
              // is just the canonical link.
              body: buildInvitationUrl(token),
            },
          }),
        ),
      );

      return invitation;
    }),

  resend: auditedAdminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    return prisma.invitation.update({
      where: { id: input.id },
      data: { status: InvitationStatus.PENDING },
    });
  }),

  trackDelivery: auditedAdminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['PENDING', 'SENT', 'DELIVERED']),
      }),
    )
    .mutation(async ({ input }) => {
      return prisma.invitation.update({
        where: { id: input.id },
        data: {
          status: input.status,
          sentAt: input.status === 'SENT' || input.status === 'DELIVERED' ? new Date() : null,
        },
      });
    }),

  getByEvent: auditedAdminProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input }) => {
      return prisma.invitation.findMany({
        where: { eventId: input.eventId },
        include: {
          household: true,
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  getByHousehold: auditedAdminProcedure
    .input(z.object({ householdId: z.string() }))
    .query(async ({ input }) => {
      return prisma.invitation.findMany({
        where: { householdId: input.householdId },
        include: {
          event: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  /**
   * FPP-88: read-only counterpart to `consume`. The RSVP wizard
   * landing page (`/events/invitation/[token]`) needs to surface
   * the invitation before the user has finished the wizard
   * steps, so we cannot burn the token there. `validate` mirrors
   * the same pre-flight checks (existence, not USED, not
   * EXPIRED, not past `expiresAt`) but does NOT mutate the row.
   * Token consumption is deferred to `consume`, which the wizard
   * calls once Step 5 (confirm) commits.
   *
   * @todo FPP-89: swap to a guest-token procedure (a new
   *   `publicProcedure` variant or `protectedProcedure` keyed on
   *   a signed token) before the public landing page route ships.
   *   This procedure currently uses `auditedAdminProcedure` for
   *   parity with `consume`; unauthenticated callers cannot
   *   reach it yet.
   */
  validate: procedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const invitation = await prisma.invitation.findUnique({
        where: { token: input.token },
        include: {
          event: true,
          household: true,
          user: true,
        },
      });

      if (!invitation) {
        throw new Error('Invitation not found');
      }

      if (invitation.status === InvitationStatus.USED) {
        throw new Error('This invitation has already been used');
      }

      if (invitation.status === InvitationStatus.EXPIRED) {
        throw new Error('This invitation has expired');
      }

      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        // Do NOT persist EXPIRED here. `validate` is read-only; if
        // the row is past its `expiresAt` we just refuse it. The
        // sweeper (TODO) or `consume` writes the EXPIRED status.
        throw new Error('This invitation has expired');
      }

      return invitation;
    }),

  consume: procedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const invitation = await prisma.invitation.findUnique({
        where: { token: input.token },
      });

      if (!invitation) {
        throw new Error('Invitation not found');
      }

      if (invitation.status === InvitationStatus.USED) {
        throw new Error('This invitation has already been used');
      }

      if (invitation.status === InvitationStatus.EXPIRED) {
        throw new Error('This invitation has expired');
      }

      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.EXPIRED },
        });
        throw new Error('This invitation has expired');
      }

      // FPP-89 review: `consume` is a public mutation now that the
      // RSVP wizard calls it from an unauthenticated browser. We log
      // every successful burn to AdminAuditLog so a bad actor with
      // a list of valid tokens leaves a trail. Action name uses the
      // procedure path so existing audit-log viewers surface it
      // alongside `invitation.send` and similar entries.
      const result = await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.USED },
        include: {
          event: true,
          household: true,
          user: true,
        },
      });

      await writeAuditLog({
        userId: invitation.invitedByUserId,
        eventId: invitation.eventId,
        action: 'invitation.consume',
        newValue: { invitationId: invitation.id, token: input.token.slice(0, 8) },
      });

      return result;
    }),
});
