import { NextResponse } from 'next/server';
import { requireAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { InvitationStatus, CommunicationStatus, CommunicationChannel } from '~/lib/generated/enums';

export async function POST(request: Request) {
  // FPP-104: stays super-admin only. Resends share the cross-event
  // rate-limit gates with the send route; per-event host scoping
  // is tracked separately.
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 });
    }

    const invitation = await prisma.invitation.update({
      where: { id },
      data: {
        status: InvitationStatus.PENDING,
        sentAt: null,
      },
    });

    const users = await prisma.user.findMany({
      where: invitation.householdId
        ? { householdId: invitation.householdId }
        : { id: invitation.userId! },
      select: { id: true },
    });

    await Promise.all(
      users.map((user) =>
        prisma.communicationLog.create({
          data: {
            eventId: invitation.eventId,
            sentByUserId: session.user.id,
            recipientUserId: user.id,
            channel: CommunicationChannel.EMAIL,
            status: CommunicationStatus.QUEUED,
          },
        }),
      ),
    );

    return NextResponse.json(invitation);
  } catch (error) {
    console.error('Error resending invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
