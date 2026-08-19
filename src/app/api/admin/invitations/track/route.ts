import { NextResponse } from 'next/server';
import { requireAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { InvitationStatus } from '~/lib/generated/enums';

export async function POST(request: Request) {
  // FPP-104: stays super-admin only. Delivery tracking is a
  // platform-wide audit concern; per-event hosts see their own
  // delivery summary via the events page, not this bulk endpoint.
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
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
