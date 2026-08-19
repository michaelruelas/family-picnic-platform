import { NextResponse } from 'next/server';
import { prisma } from '~/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Readiness probe target.
 *
 * Verifies the full stack is reachable: HTTP handler resolves AND
 * the database responds. Returns 200 when both are healthy, 503
 * when the DB is unreachable so k8s can route traffic away.
 *
 * Used by the Kubernetes readinessProbe — only pods that pass this
 * check receive Service traffic. Liveness is intentionally NOT
 * checked here so a DB hiccup drains traffic (good) rather than
 * restarting every pod simultaneously (bad).
 */
export async function GET() {
  try {
    // Cheap round-trip query that exercises the connection pool
    // without scanning any table. The 3s statement timeout bounds
    // the probe so a stuck DB doesn't hang the readiness check.
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: 'ok', database: 'reachable', timestamp: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: 'unavailable',
        database: 'unreachable',
        error: err instanceof Error ? err.message : 'unknown',
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    );
  }
}
