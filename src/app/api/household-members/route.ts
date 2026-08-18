import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { householdMemberCreateSchema } from '~/lib/schemas/household-member';
import { parseJsonBody, requireActiveMemberOwner } from './_helpers';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok) return parsed.response;

    const result = householdMemberCreateSchema.safeParse(parsed.body);

    if (!result.success) {
      const errors = result.error.issues.map((i) => i.message);
      return NextResponse.json(
        { error: errors[0] || 'Invalid input', code: 'BAD_REQUEST' },
        { status: 400 },
      );
    }

    // When the client omits householdId, fall back to the session
    // user's household. The onboarding wizard hits this path right
    // after the user picks a household, so the householdId has not
    // necessarily been written into client state yet.
    const targetHouseholdId = result.data.householdId ?? session.user.householdId ?? undefined;

    if (!targetHouseholdId) {
      return NextResponse.json(
        { error: 'Household ID is required', code: 'BAD_REQUEST' },
        { status: 400 },
      );
    }

    const owner = await requireActiveMemberOwner(session.user.id, targetHouseholdId);
    if (!owner.ok) return owner.response;

    const member = await prisma.householdMember.create({
      data: {
        householdId: targetHouseholdId,
        name: result.data.name.trim(),
        // FPP-122: age is now a required field on every household
        // member. The schema already rejects missing values.
        age: result.data.age,
        notes: result.data.notes?.trim() || null,
        relationship: result.data.relationship ?? null,
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error('Create household member error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
      { status: 500 },
    );
  }
}
