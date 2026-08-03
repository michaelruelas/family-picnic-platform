import { NextResponse } from 'next/server';
import { prisma } from '~/lib/prisma';

export class LastMemberError extends Error {
  constructor() {
    super('last_member');
    this.name = 'LastMemberError';
  }
}

export type JsonBodyResult =
  { ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse };

export async function parseJsonBody(request: Request): Promise<JsonBodyResult> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid JSON body', code: 'BAD_REQUEST' },
        { status: 400 },
      ),
    };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Body must be a JSON object', code: 'BAD_REQUEST' },
        { status: 400 },
      ),
    };
  }
  return { ok: true, body: raw as Record<string, unknown> };
}

export type ActiveMemberOwnerResult =
  { ok: true; user: { id: string; householdId: string } } | { ok: false; response: NextResponse };

export async function requireActiveMemberOwner(
  sessionUserId: string,
  targetHouseholdId: string,
): Promise<ActiveMemberOwnerResult> {
  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true, householdId: true, deletedAt: true },
  });

  if (!user || user.deletedAt !== null) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Account is inactive', code: 'UNAUTHORIZED' },
        { status: 401 },
      ),
    };
  }

  if (!user.householdId || user.householdId !== targetHouseholdId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'You can only manage members in your own household', code: 'FORBIDDEN' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user: { id: user.id, householdId: user.householdId } };
}
