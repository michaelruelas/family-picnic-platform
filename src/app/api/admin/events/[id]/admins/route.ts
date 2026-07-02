import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { AdminPermission } from '~/lib/generated/enums';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: eventId } = await params;
  const body = await req.json();
  const { userId, role = 'COADMIN' } = body;

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const existingAdmin = await prisma.eventAdmin.findUnique({
    where: {
      eventId_userId: {
        eventId,
        userId,
      },
    },
  });

  if (existingAdmin) {
    return NextResponse.json({ error: 'User is already an admin' }, { status: 409 });
  }

  const admin = await prisma.eventAdmin.create({
    data: {
      eventId,
      userId,
      role: role as AdminPermission,
    },
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

  return NextResponse.json(admin, { status: 201 });
}
