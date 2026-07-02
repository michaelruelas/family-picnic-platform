import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { photoId } = await request.json();

    if (!photoId) {
      return NextResponse.json({ error: 'photoId is required' }, { status: 400 });
    }

    const { prisma } = await import('~/lib/prisma');

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    const isAdmin = user?.role === 'ADMIN';
    const isUploader = photo.uploadedByUserId === session.user.id;

    if (!isAdmin && !isUploader) {
      return NextResponse.json(
        { error: 'Only the uploader or an admin can delete this photo' },
        { status: 403 },
      );
    }

    await prisma.photo.update({
      where: { id: photoId },
      data: { deletedAt: new Date() },
    });

    await prisma.adminAuditLog.create({
      data: {
        userId: session.user.id,
        eventId: photo.eventId,
        action: 'PHOTO_DELETE',
        oldValue: { id: photo.id, caption: photo.caption, url: photo.url },
        newValue: { deletedAt: new Date().toISOString() },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Photo delete error:', error);
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 });
  }
}
