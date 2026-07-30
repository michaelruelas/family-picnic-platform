import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id: eventId, userId } = await params;

  const admin = await prisma.eventAdmin.findUnique({
    where: {
      eventId_userId: {
        eventId,
        userId,
      },
    },
  });

  if (!admin) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  }

  await prisma.eventAdmin.delete({
    where: {
      eventId_userId: {
        eventId,
        userId,
      },
    },
  });

  return NextResponse.json({ success: true });
}
