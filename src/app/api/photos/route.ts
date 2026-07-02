import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { eventId, photoPrismId, url, thumbnailUrl, caption } = body;

    if (!eventId || !photoPrismId || !url) {
      return NextResponse.json(
        { error: 'eventId, photoPrismId, and url are required' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.householdId) {
      return NextResponse.json(
        { error: 'User must belong to a household' },
        { status: 400 },
      );
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const photo = await prisma.photo.create({
      data: {
        eventId,
        uploadedByUserId: session.user.id,
        householdId: user.householdId,
        photoPrismId,
        url,
        thumbnailUrl: thumbnailUrl || url,
        caption: caption || null,
      },
    });

    return NextResponse.json(photo);
  } catch (error) {
    console.error('Create photo error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    const where: { eventId: string; deletedAt: null } = {
      eventId: eventId || '',
      deletedAt: null,
    };

    const photos = await prisma.photo.findMany({
      where,
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        reactions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(photos);
  } catch (error) {
    console.error('List photos error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
