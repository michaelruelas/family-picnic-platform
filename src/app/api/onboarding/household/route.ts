import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { Prisma } from '~/lib/generated/client';
import { householdCreateSchema } from '~/lib/schemas';

/**
 * Upsert a self-member for the given user. The roster must always
 * include the account holder, both for "at least one member is
 * required" and because the per-member RSVP form needs at least one
 * row to render. Returns silently if the user already has a member
 * entry with the same name.
 *
 * FPP-122: the roster's age column is required at the DB layer, so
 * this seed has to provide one. The user will edit the row on the
 * household page right after onboarding; we use 18 as the most
 * defensible neutral default (most adult account holders are above
 * 18 and the form rejects the value before persisting).
 */
async function seedSelfMember(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  householdId: string,
  user: { id: string; name: string },
): Promise<void> {
  const existing = await tx.householdMember.findFirst({
    where: { householdId, name: user.name, deletedAt: null },
    select: { id: true, age: true },
  });
  if (existing) {
    // FPP-122: if a previous onboarding run seeded the member
    // without an age, top it up with the neutral adult default.
    if (existing.age == null) {
      await tx.householdMember.update({
        where: { id: existing.id },
        data: { age: 18 },
      });
    }
    return;
  }
  await tx.householdMember.create({
    data: {
      householdId,
      name: user.name,
      age: 18,
    },
  });
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { joinHouseholdId } = body as { joinHouseholdId?: string };

    if (joinHouseholdId) {
      // Joining an existing household must (a) link the user and
      // (b) seed a self-member so the per-member RSVP form has at
      // least one row. Both happen in the same transaction so a
      // failure leaves the user in their previous household.
      const result = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: session.user.id },
          data: { householdId: joinHouseholdId },
        });
        const me = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { id: true, name: true },
        });
        if (me) {
          await seedSelfMember(tx, joinHouseholdId, me);
        }
        return { householdId: joinHouseholdId };
      });

      return NextResponse.json({ success: true, householdId: result.householdId });
    }

    const parsed = householdCreateSchema.safeParse({ name: body.name });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid household name';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const trimmedName = parsed.data.name.trim();

    try {
      // Create the household and a self-member for the new account
      // holder in the same transaction. The household roster must
      // always include the user themselves so the per-member RSVP
      // form has at least one row on the first visit. The user can
      // add more family members from the household page after
      // onboarding completes.
      const result = await prisma.$transaction(async (tx) => {
        const household = await tx.household.create({
          data: { name: trimmedName },
        });

        await tx.user.update({
          where: { id: session.user.id },
          data: { householdId: household.id },
        });

        const me = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { id: true, name: true },
        });
        if (me) {
          await seedSelfMember(tx, household.id, me);
        }

        return household;
      });

      return NextResponse.json({ success: true, householdId: result.id });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json(
          { error: 'A household with this name already exists' },
          { status: 409 },
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('Onboarding household error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
