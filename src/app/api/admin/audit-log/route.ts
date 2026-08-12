import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '~/lib/admin-auth';
import { listAuditLogEntries } from '~/server/audit-entries';
import { auditLogFilterSchema } from '~/lib/schemas/audit';

export async function GET(request: NextRequest) {
  // FPP-104: stays super-admin only. The audit log is the
  // platform-wide audit trail; per-event hosts do not read it
  // directly.
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const parsed = auditLogFilterSchema.safeParse({
    eventId: searchParams.get('eventId') ?? undefined,
    userId: searchParams.get('userId') ?? undefined,
    action: searchParams.get('action') ?? undefined,
    subjectType: searchParams.get('subjectType') ?? undefined,
    subjectId: searchParams.get('subjectId') ?? undefined,
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid filter parameters', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const entries = await listAuditLogEntries(parsed.data);
  return NextResponse.json(entries);
}
