import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { Prisma } from '~/lib/generated/client';
import { householdCreateSchema } from '~/lib/schemas';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { joinHouseholdId } = body as { joinHouseholdId?: string };

    if (joinHouseholdId) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { householdId: joinHouseholdId },
      });
      return NextResponse.json({ success: true, householdId: joinHouseholdId });
    }

    const parsed = householdCreateSchema.safeParse({ name: body.name });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid household name';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const trimmedName = parsed.data.name.trim();

    try {
      const household = await prisma.household.create({
        data: { name: trimmedName },
      });

      await prisma.user.update({
        where: { id: session.user.id },
        data: { householdId: household.id },
      });

      return NextResponse.json({ success: true, householdId: household.id });
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
