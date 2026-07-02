import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { Relationship } from '~/lib/generated/client';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, relationship, age, dietaryLabels, isChild } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const validRelationships: Relationship[] = [
      'SPOUSE',
      'CHILD',
      'PARENT',
      'SIBLING',
      'INLAW',
      'COUSIN',
    ];
    if (!relationship || !validRelationships.includes(relationship)) {
      return NextResponse.json({ error: 'Valid relationship is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, householdId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const householdId = user.householdId || user.id;

    const dependent = await prisma.dependent.create({
      data: {
        name: name.trim(),
        relationship,
        age: age !== undefined && age !== null ? Number(age) : null,
        dietaryLabels: Array.isArray(dietaryLabels) ? dietaryLabels : [],
        isChild: Boolean(isChild),
        householdId,
        managedByUserId: session.user.id,
      },
    });

    return NextResponse.json(dependent, { status: 201 });
  } catch (error) {
    console.error('Create dependent error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, name, relationship, age, dietaryLabels, isChild } = body;

    if (!id) {
      return NextResponse.json({ error: 'Dependent ID is required' }, { status: 400 });
    }

    const existing = await prisma.dependent.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt !== null) {
      return NextResponse.json({ error: 'Dependent not found' }, { status: 404 });
    }

    if (existing.managedByUserId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updateData: {
      name?: string;
      relationship?: Relationship;
      age?: number | null;
      dietaryLabels?: string[];
      isChild?: boolean;
    } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (relationship !== undefined) {
      const validRelationships: Relationship[] = [
        'SPOUSE',
        'CHILD',
        'PARENT',
        'SIBLING',
        'INLAW',
        'COUSIN',
      ];
      if (!validRelationships.includes(relationship)) {
        return NextResponse.json({ error: 'Invalid relationship' }, { status: 400 });
      }
      updateData.relationship = relationship;
    }

    if (age !== undefined) {
      updateData.age = age !== null && age !== undefined ? Number(age) : null;
    }

    if (dietaryLabels !== undefined) {
      if (!Array.isArray(dietaryLabels)) {
        return NextResponse.json({ error: 'dietaryLabels must be an array' }, { status: 400 });
      }
      updateData.dietaryLabels = dietaryLabels;
    }

    if (isChild !== undefined) {
      updateData.isChild = Boolean(isChild);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const dependent = await prisma.dependent.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(dependent);
  } catch (error) {
    console.error('Update dependent error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Dependent ID is required' }, { status: 400 });
    }

    const existing = await prisma.dependent.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt !== null) {
      return NextResponse.json({ error: 'Dependent not found' }, { status: 404 });
    }

    if (existing.managedByUserId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await prisma.dependent.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete dependent error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
