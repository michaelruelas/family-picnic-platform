import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import { CommunicationPreference } from '~/lib/generated/enums';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { communicationPreference } = body;

    const validPreferences: CommunicationPreference[] = ['EMAIL', 'SMS', 'BOTH', 'NONE'];
    if (communicationPreference && !validPreferences.includes(communicationPreference)) {
      return NextResponse.json({ error: 'Invalid communication preference' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        onboardingCompletedAt: new Date(),
        communicationPreference: communicationPreference || 'EMAIL',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Onboarding complete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
