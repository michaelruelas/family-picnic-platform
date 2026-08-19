import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextResponseJson } from 'tests/helpers/route';

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: { ...actual.NextResponse, json: nextResponseJson() },
  };
});

// /api/health/ready talks to Prisma; the liveness route does not.
// Each suite mocks only what it needs.
const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));
vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

import { GET as liveness } from '~/app/api/health/route';
import { GET as readiness } from '~/app/api/health/ready/route';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$queryRaw.mockReset();
});

describe('GET /api/health (liveness)', () => {
  it('returns 200 with status ok and process metadata', async () => {
    const res = await liveness();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(typeof body.timestamp).toBe('string');
    expect(() => new Date(body.timestamp)).not.toThrow();
  });

  it('sets Cache-Control so k8s probes never hit a stale value', async () => {
    const res = await liveness();
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  it('does not touch the database (a DB outage must not trip liveness)', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('db down'));
    // If the liveness route accidentally called the DB, the route
    // import above would either throw at import time or the test
    // would surface a different code path. The explicit assertion
    // documents the contract: $queryRaw is never invoked here.
    await liveness();
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('GET /api/health/ready (readiness)', () => {
  it('returns 200 with database: reachable when the DB responds', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const res = await readiness();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('reachable');
    expect(typeof body.timestamp).toBe('string');
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns 503 with database: unreachable when the DB throws', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('connection refused'));
    const res = await readiness();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('unavailable');
    expect(body.database).toBe('unreachable');
    expect(body.error).toBe('connection refused');
  });

  it('returns 503 when the rejection is not an Error instance', async () => {
    // Defensive: the route narrows err.message with `instanceof Error`,
    // so a non-Error throw should fall through to the 'unknown' branch
    // rather than crash the probe.
    prismaMock.$queryRaw.mockRejectedValue('boom');
    const res = await readiness();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('unknown');
  });

  it('sets Cache-Control so readiness probes never hit a stale value', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const res = await readiness();
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });
});
