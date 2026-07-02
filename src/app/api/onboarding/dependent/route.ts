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
      select: { householdId: true },
    });

    if (!user?.householdId) {
      return NextResponse.json({ error: 'Must have a household first' }, { status: 400 });
    }

    const body = await request.json();
    const { name, relationship, age, isChild } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const dependent = await prisma.dependent.create({
      data: {
        householdId: user.householdId,
        managedByUserId: session.user.id,
        name: name.trim(),
        relationship: relationship || 'SPOUSE',
        age: age ? parseInt(age, 10) : null,
        isChild: isChild || false,
      },
    });

    return NextResponse.json({ success: true, dependent });
  } catch (error) {
    console.error('Onboarding dependent error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
