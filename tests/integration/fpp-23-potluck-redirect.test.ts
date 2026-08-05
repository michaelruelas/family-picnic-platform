import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetPrismaMock } from 'tests/helpers/route';

const prismaMock = vi.hoisted(() => ({
  event: { findFirst: vi.fn() },
}));
vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

import { GET } from '~/app/potluck/route';

beforeEach(() => {
  resetPrismaMock(prismaMock);
});

describe('GET /potluck redirect', () => {
  it('returns a 301 redirect to /events/:id/potluck when an upcoming event with slots exists', async () => {
    prismaMock.event.findFirst.mockResolvedValue({ id: 'evt-future' });
    const response = await GET(new Request('http://localhost/potluck'));
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('http://localhost/events/evt-future/potluck');
  });

  it('queries for published events with future dates that have at least one potluck slot', async () => {
    prismaMock.event.findFirst.mockResolvedValue({ id: 'evt-future' });
    await GET(new Request('http://localhost/potluck'));
    const call = prismaMock.event.findFirst.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call?.where?.status).toBe('PUBLISHED');
    expect(call?.where?.date).toEqual({ gte: expect.any(Date) });
    expect(call?.where?.potluckSlots).toEqual({ some: {} });
    expect(call?.orderBy).toEqual({ date: 'asc' });
    expect(call?.select).toEqual({ id: true });
  });

  it('returns a 404 HTML response with a link to /events when no event matches', async () => {
    prismaMock.event.findFirst.mockResolvedValue(null);
    const response = await GET(new Request('http://localhost/potluck'));
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toMatch(/text\/html/);
    const body = await response.text();
    expect(body).toMatch(/No potluck yet/i);
    expect(body).toContain('href="/events"');
  });
});
