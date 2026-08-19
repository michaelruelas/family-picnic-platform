import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Lightweight liveness probe target.
 *
 * Returns 200 as long as the Node.js process is responsive and the
 * route handler resolves. Deliberately does NOT touch the database:
 * a DB hiccup must not trip liveness (that would force-restart every
 * pod simultaneously). DB-backed readiness lives at /api/health/ready.
 *
 * Used by the Kubernetes startupProbe and livenessProbe — both
 * check "is the process alive and serving HTTP?", nothing more.
 */
export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        // k8s probes shouldn't be cached anywhere — they need to
        // observe the current process state on every call.
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    },
  );
}
