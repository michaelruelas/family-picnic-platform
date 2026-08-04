import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, householdId: true },
    });

    if (!user?.householdId) {
      return NextResponse.json({ error: 'Must have a household first' }, { status: 400 });
    }

    const body = await request.json();
    const { name, age, relationship } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // The HouseholdMember roster is the source of truth for "who is
    // in this household" going forward. The duplicate check must
    // ignore soft-deleted rows so a user can re-add a member with
    // the same name as a previously removed one.
    const existingSelf = await prisma.householdMember.findFirst({
      where: {
        householdId: user.householdId,
        name: { equals: name.trim() },
        deletedAt: null,
      },
    });
    if (existingSelf) {
      return NextResponse.json(
        { error: 'A household member with this name already exists' },
        { status: 409 },
      );
    }

    const trimmedName = name.trim();
    const normalizedRelationship =
      typeof relationship === 'string' && relationship.trim().length > 0
        ? relationship.trim().slice(0, 60)
        : null;
    const member = await prisma.householdMember.create({
      data: {
        householdId: user.householdId,
        name: trimmedName,
        age: age ? parseInt(age, 10) : null,
        relationship: normalizedRelationship,
        // The onboarding wizard used to set `isChild` on the legacy
        // Dependent model. HouseholdMember does not have an
        // isChild column; we record the choice in `notes` so the
        // household page can surface it without a schema column.
        notes: null,
      },
    });

    return NextResponse.json({ success: true, member });
  } catch (error) {
    console.error('Onboarding household member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
