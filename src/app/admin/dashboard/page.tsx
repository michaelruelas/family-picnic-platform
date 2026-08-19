import Link from 'next/link';
import { requireAdminPage } from '~/lib/admin-auth';
import { prisma } from '~/lib/prisma';
import { RSVPStatus, ChargeStatus } from '~/lib/generated/enums';
import DashboardTable, { type AdminDashboardRow } from '~/components/admin/DashboardTable';
import AdminShell from '~/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

/**
 * Dashboard data is gathered in one round-trip per relation instead of one
 * per event. The previous implementation ran N+1 queries (rsvps, potluck
 * slots, audit logs nested inside `events.map(...)`); this version fans out
 * to four parallel queries that are bounded by the table size, not the event
 * count.
 */
async function getDashboardRows(): Promise<AdminDashboardRow[]> {
  const [events, rsvps, slots, charges, auditLogs] = await Promise.all([
    prisma.event.findMany({ orderBy: { date: 'desc' } }),
    prisma.rSVP.findMany({
      select: { eventId: true, status: true, headcount: true },
    }),
    prisma.potluckSlot.findMany({
      select: {
        eventId: true,
        // FPP-Postmortem: count only live signups (exclude soft-deleted).
        _count: { select: { signups: { where: { deletedAt: null } } } },
      },
    }),
    prisma.charge.findMany({
      where: { status: ChargeStatus.SUCCEEDED },
      select: {
        registration: { select: { eventId: true } },
        amountCents: true,
      },
    }),
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        eventId: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  const rsvpsByEvent = new Map<
    string,
    { total: number; confirmed: number; declined: number; pending: number; headcount: number }
  >();
  for (const r of rsvps) {
    const cur = rsvpsByEvent.get(r.eventId) ?? {
      total: 0,
      confirmed: 0,
      declined: 0,
      pending: 0,
      headcount: 0,
    };
    cur.total += 1;
    if (r.status === RSVPStatus.CONFIRMED) {
      cur.confirmed += 1;
      cur.headcount += r.headcount;
    } else if (r.status === RSVPStatus.DECLINED) {
      cur.declined += 1;
    } else if (r.status === RSVPStatus.PENDING || r.status === RSVPStatus.INVITED) {
      cur.pending += 1;
    }
    rsvpsByEvent.set(r.eventId, cur);
  }

  const slotsByEvent = new Map<string, { slotCount: number; signupCount: number }>();
  for (const s of slots) {
    const cur = slotsByEvent.get(s.eventId) ?? { slotCount: 0, signupCount: 0 };
    cur.slotCount += 1;
    cur.signupCount += s._count.signups;
    slotsByEvent.set(s.eventId, cur);
  }

  const chargesByEvent = new Map<string, number>();
  for (const c of charges) {
    if (!c.registration?.eventId) continue;
    chargesByEvent.set(
      c.registration.eventId,
      (chargesByEvent.get(c.registration.eventId) ?? 0) + c.amountCents,
    );
  }

  // Most recent audit per event. The findMany above is sorted desc, so the
  // first hit wins per eventId.
  const lastAuditByEvent = new Map<string, { at: Date; by: string }>();
  for (const a of auditLogs) {
    if (!a.eventId || lastAuditByEvent.has(a.eventId)) continue;
    const name = a.user?.name ?? a.user?.email ?? null;
    lastAuditByEvent.set(a.eventId, { at: a.createdAt, by: name ?? '' });
  }

  return events.map((e): AdminDashboardRow => {
    const r = rsvpsByEvent.get(e.id) ?? {
      total: 0,
      confirmed: 0,
      declined: 0,
      pending: 0,
      headcount: 0,
    };
    const s = slotsByEvent.get(e.id) ?? { slotCount: 0, signupCount: 0 };
    const charges = chargesByEvent.get(e.id) ?? 0;
    const last = lastAuditByEvent.get(e.id) ?? null;
    return {
      id: e.id,
      name: e.name,
      date: e.date.toISOString(),
      status: e.status,
      location: e.location,
      maxCapacity: e.maxCapacity ?? null,
      rsvpTotal: r.total,
      rsvpConfirmed: r.confirmed,
      rsvpDeclined: r.declined,
      rsvpPending: r.pending,
      headcount: r.headcount,
      potluckSlotCount: s.slotCount,
      potluckSignupCount: s.signupCount,
      chargesTotalCents: charges,
      lastActionAt: last ? last.at.toISOString() : null,
      lastActionBy: last?.by ?? null,
    };
  });
}

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const rows = await getDashboardRows();

  return (
    <AdminShell title="Admin Dashboard" description="Overview of all family picnic events">
      {rows.length === 0 ? (
        <div className="bg-secondary rounded-sm p-12 text-center">
          <div className="text-5xl">📊</div>
          <h2 className="text-foreground mt-4 text-xl font-semibold">No Events Yet</h2>
          <p className="text-muted-foreground mt-2">
            Create your first event to start seeing dashboard metrics.
          </p>
          <Link
            href="/admin/events/new"
            className="bg-terracotta hover:bg-terracotta mt-6 inline-block rounded-sm px-6 py-2 font-medium text-white"
          >
            Create First Event
          </Link>
        </div>
      ) : (
        <DashboardTable rows={rows} />
      )}
    </AdminShell>
  );
}
