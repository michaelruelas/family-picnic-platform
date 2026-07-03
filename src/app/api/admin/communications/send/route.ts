import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { CommunicationStatus, RSVPStatus } from '~/lib/generated/enums';
import { generateRequestId, createRequestLogger } from '~/lib/logger';
import { createTraceContext, runWithTraceContext } from '~/lib/tracing';

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const session = await getServerSession(authOptions);

  const log = createRequestLogger({
    requestId,
    userId: session?.user?.id,
    route: '/api/admin/communications/send',
  });

  return runWithTraceContext(
    createTraceContext(requestId, session?.user?.id, '/api/admin/communications/send'),
    async () => {
      if (!session?.user?.id || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      let eventId: string | undefined;

      try {
        const body = await request.json();
        const { eventId: reqEventId, message, channel, recipientType, recipientIds } = body;
        eventId = reqEventId;

        if (!eventId || !message || !channel || !recipientType) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        let targetUserIds: string[] = [];

        switch (recipientType) {
          case 'ALL':
            targetUserIds = (
              await prisma.user.findMany({
                where: { householdId: { not: null } },
                select: { id: true },
              })
            ).map((u) => u.id);
            break;
          case 'NOT_RESPONDED':
            targetUserIds = (
              await prisma.user.findMany({
                where: {
                  householdId: { not: null },
                  rsvps: {
                    none: {
                      eventId,
                      status: { in: [RSVPStatus.CONFIRMED, RSVPStatus.DECLINED] },
                    },
                  },
                },
                select: { id: true },
              })
            ).map((u) => u.id);
            break;
          case 'HOUSEHOLD':
            if (!recipientIds || !Array.isArray(recipientIds)) {
              return NextResponse.json(
                { error: 'recipientIds required for HOUSEHOLD type' },
                { status: 400 },
              );
            }
            targetUserIds = (
              await prisma.user.findMany({
                where: { householdId: { in: recipientIds } },
                select: { id: true },
              })
            ).map((u) => u.id);
            break;
          case 'INDIVIDUAL':
            if (!recipientIds || !Array.isArray(recipientIds)) {
              return NextResponse.json(
                { error: 'recipientIds required for INDIVIDUAL type' },
                { status: 400 },
              );
            }
            targetUserIds = recipientIds;
            break;
        }

        const logs = await Promise.all(
          targetUserIds.map((userId) =>
            prisma.communicationLog.create({
              data: {
                eventId: eventId!,
                sentByUserId: session.user.id,
                recipientUserId: userId,
                channel,
                status: CommunicationStatus.QUEUED,
              },
            }),
          ),
        );

        return NextResponse.json({ success: true, count: logs.length });
      } catch (error) {
        log.error({ err: error, eventId }, 'Error sending broadcast');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
  );
}
