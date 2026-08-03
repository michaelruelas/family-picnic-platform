import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { householdMemberUpdateSchema } from '~/lib/schemas/household-member';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const result = householdMemberUpdateSchema.safeParse({ ...body, id });

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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { householdId: true },
    });

    if (!user?.householdId || user.householdId !== existing.householdId) {
      return NextResponse.json(
        { error: 'You can only edit members in your own household', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { householdId: true },
    });

    if (!user?.householdId || user.householdId !== existing.householdId) {
      return NextResponse.json(
        { error: 'You can only remove members from your own household', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    const remaining = await prisma.householdMember.count({
      where: { householdId: existing.householdId, deletedAt: null },
    });

    if (remaining <= 1) {
      return NextResponse.json(
        { error: 'At least one household member is required', code: 'BAD_REQUEST' },
        { status: 400 },
      );
    }

    await prisma.householdMember.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete household member error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
      { status: 500 },
    );
  }
}
