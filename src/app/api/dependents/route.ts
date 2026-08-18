import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { z } from 'zod';
import { generateRequestId, createRequestLogger } from '~/lib/logger';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const dependents = await prisma.dependent.findMany({
      where: {
        managedByUserId: session.user.id,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(dependents);
  } catch (error) {
    console.error('Get dependents error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const requestId = generateRequestId();
  const session = await getServerSession(authOptions);

  const log = createRequestLogger({
    requestId,
    userId: session?.user?.id,
    route: '/api/dependents',
  });

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, relationship, age, dietaryLabels, isChild } = body;

    const createResult = z
      .object({
        name: z.string().min(1, 'Name is required').trim().min(1),
        relationship: z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'INLAW', 'COUSIN'] as const),
        // FPP-122: age is required on create so the per-member
        // attendance list and fee calc stay consistent.
        age: z
          .number({ error: 'Age is required' })
          .int('Age must be a whole number')
          .nonnegative('Age cannot be negative')
          .max(120, 'Age must be 120 or fewer'),
        dietaryLabels: z.array(z.string()).default([]),
        isChild: z.boolean().default(false),
      })
      .safeParse({ name, relationship, age, dietaryLabels, isChild });

    if (!createResult.success) {
      const errors = createResult.error.issues.map((i) => i.message);
      return NextResponse.json(
        { error: errors[0] || 'Invalid input', code: 'BAD_REQUEST' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        householdId: true,
        household: { select: { id: true, deletedAt: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // The householdId must reference a live Household row. A user
    // with no household (skipped onboarding) or whose household was
    // soft-deleted cannot create Dependents here; route them back
    // through onboarding instead. FPP-103.
    if (!user.household || user.household.deletedAt !== null) {
      log.warn(
        {
          householdId: user.householdId,
          householdDeletedAt: user.household?.deletedAt ?? null,
        },
        'POST /api/dependents rejected: USER_HAS_NO_HOUSEHOLD',
      );
      return NextResponse.json(
        {
          error: 'Complete onboarding before adding family members.',
          code: 'USER_HAS_NO_HOUSEHOLD',
        },
        { status: 409 },
      );
    }

    const dependent = await prisma.dependent.create({
      data: {
        name: name.trim(),
        relationship,
        // FPP-122: the schema now guarantees a numeric age.
        age: Number(age),
        dietaryLabels: Array.isArray(dietaryLabels) ? dietaryLabels : [],
        isChild: Boolean(isChild),
        householdId: user.household.id,
        managedByUserId: session.user.id,
      },
    });

    return NextResponse.json(dependent, { status: 201 });
  } catch (error) {
    log.error({ err: error }, 'Create dependent error');
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, name, relationship, age, dietaryLabels, isChild } = body;

    const updateResult = z
      .object({
        id: z.string().min(1, 'Dependent ID is required'),
        name: z.string().trim().min(1, 'Name cannot be empty').optional(),
        relationship: z
          .enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'INLAW', 'COUSIN'] as const)
          .optional(),
        // FPP-122: match the create bounds; reject nulls so we
        // don't regress the required-age contract.
        age: z
          .number()
          .int('Age must be a whole number')
          .nonnegative('Age cannot be negative')
          .max(120, 'Age must be 120 or fewer')
          .optional(),
        dietaryLabels: z.array(z.string()).optional(),
        isChild: z.boolean().optional(),
      })
      .safeParse({ id, name, relationship, age, dietaryLabels, isChild });

    if (!updateResult.success) {
      const errors = updateResult.error.issues.map((i) => i.message);
      return NextResponse.json(
        { error: errors[0] || 'Invalid input', code: 'BAD_REQUEST' },
        { status: 400 },
      );
    }

    const { id: dependentId, ...updateData } = updateResult.data;

    const existing = await prisma.dependent.findUnique({
      where: { id: dependentId },
    });

    if (!existing || existing.deletedAt !== null) {
      return NextResponse.json(
        { error: 'Dependent not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    if (existing.managedByUserId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'FORBIDDEN' }, { status: 403 });
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update', code: 'BAD_REQUEST' },
        { status: 400 },
      );
    }

    const dependent = await prisma.dependent.update({
      where: { id: dependentId },
      data: updateData,
    });

    return NextResponse.json(dependent);
  } catch (error) {
    console.error('Update dependent error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Dependent ID is required', code: 'BAD_REQUEST' },
        { status: 400 },
      );
    }

    const existing = await prisma.dependent.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt !== null) {
      return NextResponse.json(
        { error: 'Dependent not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    if (existing.managedByUserId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'FORBIDDEN' }, { status: 403 });
    }

    await prisma.dependent.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete dependent error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
      { status: 500 },
    );
  }
}
