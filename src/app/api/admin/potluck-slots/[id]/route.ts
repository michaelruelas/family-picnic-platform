import { NextResponse } from 'next/server';
import { requireEventAdminApi, requireSessionApi } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * FPP-104: per-event gate. Look up the slot's parent event id, then
 * gate on `requireEventAdminApi(eventId)`. Mirrors the tRPC
 * `potluck.updateSlot` procedure's move to `eventAdminProcedure`.
 *
 * `requireSessionApi` runs first so an unauthenticated caller gets
 * 401 before any DB read — the slot lookup below would otherwise
 * leak whether the slot exists (404) versus whether the caller is
 * allowed (403). The preloaded session is then handed to
 * `requireEventAdminApi` to avoid a second `getServerSession` call.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const sessionAuth = await requireSessionApi();
  if (!sessionAuth.ok) return sessionAuth.response;
  const preloadedSession = sessionAuth.session;

  let lookup: { id: string; eventId: string; slotType: string };
  try {
    const { id } = await params;
    const row = await prisma.potluckSlot.findUnique({
      where: { id },
      select: { id: true, eventId: true, slotType: true },
    });
    if (!row) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }
    lookup = row;
  } catch (error) {
    console.error('Failed to load potluck slot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  const auth = await requireEventAdminApi(lookup.eventId, { preloadedSession });
  if (!auth.ok) return auth.response;
  void auth.session;

  try {
    const body = await request.json();
    const { name, maxSignups } = body;

    const updateData: { name?: string | null; maxSignups?: number | null } = {};
    if (name !== undefined) {
      if (typeof name !== 'string') {
        return NextResponse.json({ error: 'name must be a string if provided' }, { status: 400 });
      }
      const trimmed = name.trim();
      updateData.name = trimmed === '' ? null : trimmed;
    }
    if (maxSignups !== undefined) {
      if (lookup.slotType === 'LIMITED') {
        if (!maxSignups || maxSignups < 1) {
          return NextResponse.json(
            { error: 'maxSignups must be at least 1 for LIMITED slots' },
            { status: 400 },
          );
        }
        updateData.maxSignups = maxSignups;
      }
    }

    const updatedSlot = await prisma.potluckSlot.update({
      where: { id: lookup.id },
      data: updateData,
    });

    return NextResponse.json(updatedSlot);
  } catch (error) {
    console.error('Failed to update potluck slot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * FPP-104: per-event gate, same pattern as PATCH. Mirrors the tRPC
 * `potluck.deleteSlot` procedure's move to `eventAdminProcedure`.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const sessionAuth = await requireSessionApi();
  if (!sessionAuth.ok) return sessionAuth.response;
  const preloadedSession = sessionAuth.session;

  let lookup: { id: string; eventId: string };
  try {
    const { id } = await params;
    const row = await prisma.potluckSlot.findUnique({
      where: { id },
      select: { id: true, eventId: true },
    });
    if (!row) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }
    lookup = row;
  } catch (error) {
    console.error('Failed to load potluck slot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  const auth = await requireEventAdminApi(lookup.eventId, { preloadedSession });
  if (!auth.ok) return auth.response;
  void auth.session;

  try {
    await prisma.potluckSlot.delete({ where: { id: lookup.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete potluck slot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
