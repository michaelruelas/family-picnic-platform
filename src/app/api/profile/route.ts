import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { CommunicationPreference } from '~/lib/generated/client';
import { z } from 'zod';

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await request.json();
    const { name, communicationPreference } = body;

    const updateResult = z.object({
      name: z.string().trim().min(1, 'Name is required').optional(),
      communicationPreference: z.enum(['EMAIL', 'SMS', 'BOTH', 'NONE'] as const).optional(),
    }).safeParse({ name, communicationPreference });

    if (!updateResult.success) {
      const errors = updateResult.error.issues.map((i) => i.message);
      return NextResponse.json({ error: errors[0] || 'Invalid input', code: 'BAD_REQUEST' }, { status: 400 });
    }

    const { name: validName, communicationPreference: validPref } = updateResult.data;

    const updateData: {
      name?: string;
      communicationPreference?: CommunicationPreference;
    } = {};

    if (validName !== undefined) {
      updateData.name = validName;
    }

    if (validPref !== undefined) {
      updateData.communicationPreference = validPref;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update', code: 'BAD_REQUEST' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        communicationPreference: true,
        household: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        communicationPreference: true,
        household: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}
