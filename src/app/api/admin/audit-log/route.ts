import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const eventId = searchParams.get('eventId') || undefined;
  const userId = searchParams.get('userId') || undefined;
  const action = searchParams.get('action') || undefined;

  const logs = await prisma.adminAuditLog.findMany({
    where: {
      eventId,
      userId,
      action: action ? { contains: action } : undefined,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      event: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json(logs);
}
