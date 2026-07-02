import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { generateInvitationToken, getInvitationExpiry } from '~/lib/invitation-token';
import { InvitationStatus, CommunicationStatus, CommunicationChannel } from '~/lib/generated/enums';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId, householdId, userId, channel = 'EMAIL' } = await request.json();

    if (!eventId || (!householdId && !userId)) {
      return NextResponse.json(
        { error: 'eventId and householdId or userId are required' },
        { status: 400 },
      );
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

    await Promise.all(
      recipientUserIds.map((recipientUserId) =>
        prisma.communicationLog.create({
          data: {
            eventId,
            sentByUserId: session.user.id,
            recipientUserId,
            channel: channel as CommunicationChannel,
            status: CommunicationStatus.QUEUED,
          },
        }),
      ),
    );

    return NextResponse.json(invitation);
  } catch (error) {
    console.error('Error sending invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
