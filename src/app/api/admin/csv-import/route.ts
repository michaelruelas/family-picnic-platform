import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { RSVPStatus, Role } from '~/lib/generated/enums';
import { z } from 'zod';
import { findOrCreateUserByEmail } from '~/lib/user-identity';

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
  // FPP-104: stays super-admin only. Bulk CSV import creates
  // invitees and RSVPs in bulk; per-event host scoping would need
  // a separate restricted import flow.
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { session } = auth;

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
        usersCreated: households.reduce(
          (sum, hh) => sum + hh.members.filter((m) => m.email).length,
          0,
        ),
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
        const { userId, created } = await findOrCreateUserByEmail(
          member.email,
          member.name,
          newHousehold.id,
          'ADMIN_ADULT',
        );
        if (created) results.usersCreated++;

        await prisma.rSVP.upsert({
          where: {
            eventId_userId: { eventId, userId },
          },
          update: {
            householdId: newHousehold.id,
            status: RSVPStatus.CONFIRMED,
            headcount: member.headcount,
            respondedAt: new Date(),
          },
          create: {
            eventId,
            userId,
            householdId: newHousehold.id,
            status: RSVPStatus.CONFIRMED,
            headcount: member.headcount,
            respondedAt: new Date(),
          },
        });
        results.rsvpsCreated++;
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
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 },
      );
    }
    console.error('CSV Import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
