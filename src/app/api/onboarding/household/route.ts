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

    const body = await request.json();
    const { name, joinHouseholdId } = body;

    if (joinHouseholdId) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { householdId: joinHouseholdId },
      });
      return NextResponse.json({ success: true, householdId: joinHouseholdId });
    }

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Household name is required' }, { status: 400 });
    }

    const household = await prisma.household.create({
      data: { name: name.trim() },
    });

    await prisma.user.update({
      where: { id: session.user.id },
      data: { householdId: household.id },
    });

    return NextResponse.json({ success: true, householdId: household.id });
  } catch (error) {
    console.error('Onboarding household error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
