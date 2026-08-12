import { NextResponse } from 'next/server';
import { TRPCError } from '@trpc/server';
import { requireAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
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
import {
  InvitationStatus,
  CommunicationStatus,
  CommunicationChannel,
  CommunicationLogKind,
} from '~/lib/generated/enums';

function trpcErrorToResponse(err: unknown): NextResponse | null {
  if (err instanceof TRPCError) {
    const status =
      err.code === 'TOO_MANY_REQUESTS'
        ? 429
        : err.code === 'BAD_REQUEST'
          ? 400
          : err.code === 'FORBIDDEN'
            ? 403
            : err.code === 'NOT_FOUND'
              ? 404
              : err.code === 'CONFLICT'
                ? 409
                : 400;
    return NextResponse.json({ error: err.message, code: err.code }, { status });
  }
  return null;
}

export async function POST(request: Request) {
  // FPP-104: stays super-admin only. Invitation sends trip
  // cross-event rate-limit gates (per-hour and per-recipient) that
  // a host shouldn't bypass by switching surfaces. Per-event host
  // scoping of invitations is tracked separately.
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const { eventId, householdId, userId, channel = 'EMAIL' } = await request.json();

    if (!eventId || (!householdId && !userId)) {
      return NextResponse.json(
        { error: 'eventId and householdId or userId are required' },
        { status: 400 },
      );
    }

    // FPP-88 review: the REST mirror must apply the same three
    // rate-limit gates as the tRPC `invitation.send` procedure;
    // otherwise an admin can flood invitations by switching
    // from the tRPC client to this route. Mirrors the tRPC
    // checks verbatim and converts TRPCError into a 429
    // response so the JSON shape matches what the rest of the
    // admin UI already handles.
    const adminBroadcastResult = await checkAdminBroadcastRateLimit(session.user.id);
    if (!adminBroadcastResult.allowed) {
      rateLimitError(adminBroadcastResult, 'invitations per hour');
    }

    const recipientGroupResult = await checkRecipientGroupRateLimit(
      session.user.id,
      eventId,
      'HOUSEHOLD',
      householdId ? [householdId] : undefined,
    );
    if (!recipientGroupResult.allowed) {
      rateLimitError(recipientGroupResult, 'invitations to same household');
    }

    const token = generateInvitationToken();
    const expiresAt = getInvitationExpiry(30);

    const invitation = await prisma.invitation.create({
      data: {
        eventId,
        householdId,
        userId,
        status: InvitationStatus.PENDING,
        invitedByUserId: session.user.id,
        token,
        expiresAt,
      },
    });

    let recipientUserIds: string[] = [];
    if (userId) {
      recipientUserIds = [userId];
    } else if (householdId) {
      const users = await prisma.user.findMany({
        where: { householdId },
        select: { id: true },
      });
      recipientUserIds = users.map((u) => u.id);
    }

    // Recipient-level rate limit runs after the recipient set
    // is known, matching the tRPC order. A blocked recipient
    // rolls back the whole send so we never leave a partial
    // invitation behind.
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
            eventId,
            sentByUserId: session.user.id,
            recipientUserId,
            channel: channel as CommunicationChannel,
            status: CommunicationStatus.QUEUED,
            // FPP-88 review: tag the row so the send pipeline
            // can branch on `kind` instead of sniffing `body`.
            // Mirrors the tRPC router.
            kind: CommunicationLogKind.INVITATION,
            // FPP-88: mirror the tRPC router and stash the wizard
            // landing page URL on the log row. The send pipeline
            // reads this when formatting the email/SMS.
            body: buildInvitationUrl(token),
          },
        }),
      ),
    );

    return NextResponse.json(invitation);
  } catch (error) {
    const mapped = trpcErrorToResponse(error);
    if (mapped) return mapped;
    console.error('Error sending invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
