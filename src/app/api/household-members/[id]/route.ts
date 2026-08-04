import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { Prisma } from '~/lib/generated/client';
import { householdMemberUpdateSchema } from '~/lib/schemas/household-member';
import { LastMemberError, parseJsonBody, requireActiveMemberOwner } from '../_helpers';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok) return parsed.response;

    const result = householdMemberUpdateSchema.safeParse({ ...parsed.body, id });

    if (!result.success) {
      const errors = result.error.issues.map((i) => i.message);
      return NextResponse.json(
        { error: errors[0] || 'Invalid input', code: 'BAD_REQUEST' },
        { status: 400 },
      );
    }

    const existing = await prisma.householdMember.findUnique({ where: { id } });

    if (!existing || existing.deletedAt !== null) {
      return NextResponse.json({ error: 'Member not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const owner = await requireActiveMemberOwner(session.user.id, existing.householdId);
    if (!owner.ok) return owner.response;

    const updateData: { name?: string; age?: number | null; notes?: string | null } = {};

    if (result.data.name !== undefined) updateData.name = result.data.name.trim();
    if (result.data.age !== undefined) updateData.age = result.data.age;
    if (result.data.notes !== undefined) {
      updateData.notes = result.data.notes === null ? null : result.data.notes.trim() || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update', code: 'BAD_REQUEST' },
        { status: 400 },
      );
    }

    const member = await prisma.householdMember.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(member);
  } catch (error) {
    console.error('Update household member error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const existing = await prisma.householdMember.findUnique({ where: { id } });

    if (!existing || existing.deletedAt !== null) {
      return NextResponse.json({ error: 'Member not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const owner = await requireActiveMemberOwner(session.user.id, existing.householdId);
    if (!owner.ok) return owner.response;

    await prisma.$transaction(
      async (tx) => {
        const remaining = await tx.householdMember.count({
          where: { householdId: existing.householdId, deletedAt: null },
        });
        if (remaining <= 1) {
          throw new LastMemberError();
        }
        // Detach attendance rows for this member before the soft
        // delete so the snapshot survives. The rows are still tied
        // to their RSVPs, but `householdMemberId` becomes null and
        // the row now represents a historical "who attended" fact
        // rather than a live roster entry. The form can still show
        // them and the user can flip them to NO on the next edit.
        await tx.rsvpMemberAttendance.updateMany({
          where: { householdMemberId: id },
          data: { householdMemberId: null },
        });
        await tx.householdMember.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof LastMemberError) {
      return NextResponse.json(
        { error: 'At least one household member is required', code: 'BAD_REQUEST' },
        { status: 400 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json(
        { error: 'Concurrent delete detected, retry', code: 'CONFLICT' },
        { status: 409 },
      );
    }
    console.error('Delete household member error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
      { status: 500 },
    );
  }
}
