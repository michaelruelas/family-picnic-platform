import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { RSVPStatus } from '~/lib/generated/enums';
import { z } from 'zod';

const CsvImportSchema = z.object({
  eventId: z.string(),
  households: z.array(
    z.object({
      name: z.string(),
      members: z.array(
        z.object({
          email: z.string().email(),
          name: z.string(),
          headcount: z.number().int().min(1).default(1),
        }),
      ),
    }),
  ),
  dryRun: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { eventId, households, dryRun } = CsvImportSchema.parse(body);

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        householdsCreated: households.length,
        usersCreated: households.reduce((sum, hh) => sum + hh.members.filter((m) => m.email).length, 0),
        rsvpsCreated: households.reduce((sum, hh) => sum + hh.members.length, 0),
        message: 'Dry run successful',
      });
    }

    const results = {
      householdsCreated: 0,
      usersCreated: 0,
      rsvpsCreated: 0,
    };

    for (const household of households) {
      const newHousehold = await prisma.household.create({
        data: { name: household.name },
      });
      results.householdsCreated++;

      for (const member of household.members) {
        const existingUser = await prisma.user.findUnique({
          where: { email: member.email },
        });

        let userId: string;

        if (existingUser) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { householdId: newHousehold.id },
          });
          userId = existingUser.id;
        } else {
          const newUser = await prisma.user.create({
            data: {
              email: member.email,
              name: member.name,
              householdId: newHousehold.id,
              role: 'ADMIN_ADULT',
            },
          });
          userId = newUser.id;
          results.usersCreated++;
        }

        const freshUser = await prisma.user.findUnique({ where: { email: member.email } });
        if (freshUser) {
          await prisma.rSVP.create({
            data: {
              eventId,
              userId: freshUser.id,
              householdId: newHousehold.id,
              status: RSVPStatus.CONFIRMED,
              headcount: member.headcount,
              respondedAt: new Date(),
            },
          });
          results.rsvpsCreated++;
        }
      }
    }

    await prisma.adminAuditLog.create({
      data: {
        eventId,
        userId: session.user.id,
        action: 'CSV_IMPORT',
        newValue: {
          householdsCreated: results.householdsCreated,
          usersCreated: results.usersCreated,
          rsvpsCreated: results.rsvpsCreated,
          totalHouseholds: households.length,
        },
      },
    });

    return NextResponse.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.issues }, { status: 400 });
    }
    console.error('CSV Import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
