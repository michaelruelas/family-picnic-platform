import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { InvitationStatus } from '~/lib/generated/enums';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, status } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: 'ID and status are required' }, { status: 400 });
    }

    if (
      ![InvitationStatus.PENDING, InvitationStatus.SENT, InvitationStatus.DELIVERED].includes(
        status,
      )
    ) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const invitation = await prisma.invitation.update({
      where: { id },
      data: {
        status: status as InvitationStatus,
        sentAt:
          status === InvitationStatus.SENT || status === InvitationStatus.DELIVERED
            ? new Date()
            : undefined,
      },
    });

    return NextResponse.json(invitation);
  } catch (error) {
    console.error('Error tracking invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
