import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';

export async function GET(req: NextRequest) {
  // FPP-104: stays super-admin only. Cross-event user search would
  // let a host probe the existence of any user by email; the
  // per-event host surface uses the existing invitation wizard
  // instead.
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  const q = searchParams.get('q')?.trim();

  // Legacy contract: `?email=...` returns a single user or 404. The
  // ⌘K command palette uses `?q=...` to do a fuzzy substring match
  // across name + email.
  if (email) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        household: { select: { name: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json(user);
  }

  if (q && q.length >= 2) {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        household: { select: { name: true } },
      },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      take: 8,
    });
    return NextResponse.json({ users });
  }

  // Legacy contract: no `email` and no `q` -> 400. The original
  // /admin/users/search endpoint required an exact email match; the
  // /admin command palette uses the `q` param for fuzzy matching.
  return NextResponse.json({ error: 'Email or query is required' }, { status: 400 });
}
