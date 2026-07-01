import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';

const VALID_REACTIONS = ['❤️', '👍', '👏', '🎉', '😂'];

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { photoId, reaction } = body;

    if (!photoId || !reaction) {
      return NextResponse.json({ error: 'photoId and reaction are required' }, { status: 400 });
    }

    if (!VALID_REACTIONS.includes(reaction)) {
      return NextResponse.json({ error: 'Invalid reaction emoji' }, { status: 400 });
    }

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const existingReaction = await prisma.photoReaction.findUnique({
      where: {
        photoId_userId_reaction: {
          photoId,
          userId: session.user.id,
          reaction,
        },
      },
    });

    if (existingReaction) {
      await prisma.photoReaction.delete({
        where: { id: existingReaction.id },
      });
      return NextResponse.json({ success: true, action: 'removed' });
    } else {
      await prisma.photoReaction.create({
        data: {
          photoId,
          userId: session.user.id,
          reaction,
        },
      });
      return NextResponse.json({ success: true, action: 'added' });
    }
  } catch (error) {
    console.error('Photo reaction error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
