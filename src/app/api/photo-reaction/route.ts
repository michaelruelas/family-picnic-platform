import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { z } from 'zod';

const VALID_REACTIONS = ['❤️', '👍', '👏', '🎉', '😂'] as const;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { photoId, reaction } = body;

    const reactionResult = z
      .object({
        photoId: z.string().min(1, 'Photo ID is required'),
        reaction: z.enum(VALID_REACTIONS),
      })
      .safeParse({ photoId, reaction });

    if (!reactionResult.success) {
      const errors = reactionResult.error.issues.map((i) => i.message);
      return NextResponse.json(
        { error: errors[0] || 'Invalid input', code: 'BAD_REQUEST' },
        { status: 400 },
      );
    }

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found', code: 'NOT_FOUND' }, { status: 404 });
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
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
      { status: 500 },
    );
  }
}
