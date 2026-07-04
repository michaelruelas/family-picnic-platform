import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { CommunicationStatus, RSVPStatus, ScheduledBroadcastStatus } from '~/lib/generated/enums';
import { generateRequestId, createRequestLogger } from '~/lib/logger';
import { createTraceContext, runWithTraceContext } from '~/lib/tracing';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const session = await getServerSession(authOptions);

  const log = createRequestLogger({
    requestId,
    userId: session?.user?.id,
    route: '/api/admin/communications/process-scheduled',
  });

  return runWithTraceContext(
    createTraceContext(requestId, session?.user?.id, '/api/admin/communications/process-scheduled'),
    async () => {
      const authHeader = request.headers.get('authorization');
      const cronSecret = process.env.CRON_SECRET;

      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      try {
        const due = await prisma.scheduledBroadcast.findMany({
          where: {
            status: ScheduledBroadcastStatus.PENDING,
            scheduledAt: { lte: new Date() },
          },
          take: 10,
        });

        const results: Array<{
          id: string;
          status: string;
          recipientCount?: number;
          error?: string;
        }> = [];

        for (const broadcast of due) {
          try {
            await prisma.scheduledBroadcast.update({
              where: { id: broadcast.id },
              data: { status: ScheduledBroadcastStatus.PROCESSING },
            });

            let targetUserIds: string[] = [];

            switch (broadcast.recipientType) {
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
                          eventId: broadcast.eventId,
                          status: { in: [RSVPStatus.CONFIRMED, RSVPStatus.DECLINED] },
                        },
                      },
                    },
                    select: { id: true },
                  })
                ).map((u) => u.id);
                break;
              case 'HOUSEHOLD': {
                const householdIds = (broadcast.recipientIds as string[]) ?? [];
                targetUserIds = (
                  await prisma.user.findMany({
                    where: { householdId: { in: householdIds } },
                    select: { id: true },
                  })
                ).map((u) => u.id);
                break;
              }
              case 'INDIVIDUAL':
                targetUserIds = (broadcast.recipientIds as string[]) ?? [];
                break;
            }

            await Promise.all(
              targetUserIds.map((userId) =>
                prisma.communicationLog.create({
                  data: {
                    eventId: broadcast.eventId,
                    sentByUserId: broadcast.sentByUserId,
                    recipientUserId: userId,
                    channel: broadcast.channel,
                    status: CommunicationStatus.QUEUED,
                  },
                }),
              ),
            );

            await prisma.scheduledBroadcast.update({
              where: { id: broadcast.id },
              data: { status: ScheduledBroadcastStatus.SENT, processedAt: new Date() },
            });

            results.push({
              id: broadcast.id,
              status: ScheduledBroadcastStatus.SENT,
              recipientCount: targetUserIds.length,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            await prisma.scheduledBroadcast.update({
              where: { id: broadcast.id },
              data: {
                status: ScheduledBroadcastStatus.FAILED,
                errorMessage: message,
                processedAt: new Date(),
              },
            });
            results.push({
              id: broadcast.id,
              status: ScheduledBroadcastStatus.FAILED,
              error: message,
            });
          }
        }

        return NextResponse.json({ processed: results.length, results });
      } catch (error) {
        log.error({ err: error }, 'Error processing scheduled broadcasts');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
  );
}
