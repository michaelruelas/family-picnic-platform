import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('~/lib/prisma', () => ({
  prisma: {
    adminAuditLog: {
      create: vi.fn(),
    },
  },
}));

describe('diff', () => {
  it('returns null when primitives are identical', async () => {
    const { diff } = await import('../audit');
    expect(diff(1, 1)).toBeNull();
    expect(diff('hello', 'hello')).toBeNull();
    expect(diff(true, true)).toBeNull();
  });

  it('returns null when both values are null', async () => {
    const { diff } = await import('../audit');
    expect(diff(null, null)).toBeNull();
  });

  it('returns null when both values are undefined', async () => {
    const { diff } = await import('../audit');
    expect(diff(undefined, undefined)).toBeNull();
  });

  it('returns _changed key for different primitives', async () => {
    const { diff } = await import('../audit');
    const result = diff(1, 2);
    expect(result).toEqual({ _changed: { old: 1, new: 2 } });
  });

  it('returns _changed key for different types (string vs number)', async () => {
    const { diff } = await import('../audit');
    const result = diff('1', 1);
    expect(result).toEqual({ _changed: { old: '1', new: 1 } });
  });

  it('returns null for deeply equal objects', async () => {
    const { diff } = await import('../audit');
    const obj = { a: 1, b: 'hello', c: true };
    expect(diff(obj, { ...obj })).toBeNull();
  });

  it('detects added keys in new object', async () => {
    const { diff } = await import('../audit');
    const result = diff({ a: 1 }, { a: 1, b: 2 });
    expect(result).toEqual({ b: { old: undefined, new: 2 } });
  });

  it('detects removed keys in new object', async () => {
    const { diff } = await import('../audit');
    const result = diff({ a: 1, b: 2 }, { a: 1 });
    expect(result).toEqual({ b: { old: 2, new: undefined } });
  });

  it('detects changed values in object', async () => {
    const { diff } = await import('../audit');
    const result = diff({ a: 1, b: 2 }, { a: 1, b: 3 });
    expect(result).toEqual({ b: { old: 2, new: 3 } });
  });

  it('handles nested objects with deep comparison via JSON', async () => {
    const { diff } = await import('../audit');
    const oldVal = { nested: { x: 1, y: 2 } };
    const newVal = { nested: { x: 1, y: 3 } };
    const result = diff(oldVal, newVal);
    expect(result).toEqual({ nested: { old: { x: 1, y: 2 }, new: { x: 1, y: 3 } } });
  });

  it('returns null for deeply equal nested objects', async () => {
    const { diff } = await import('../audit');
    const oldVal = { nested: { x: 1, y: [1, 2, 3] } };
    const newVal = { nested: { x: 1, y: [1, 2, 3] } };
    expect(diff(oldVal, newVal)).toBeNull();
  });

  it('returns null for empty objects on both sides', async () => {
    const { diff } = await import('../audit');
    expect(diff({}, {})).toBeNull();
  });

  it('handles objects with array values', async () => {
    const { diff } = await import('../audit');
    const result = diff({ items: [1, 2, 3] }, { items: [1, 2, 4] });
    expect(result).toEqual({ items: { old: [1, 2, 3], new: [1, 2, 4] } });
  });

  it('returns null when comparing identical arrays', async () => {
    const { diff } = await import('../audit');
    expect(diff([1, 2, 3], [1, 2, 3])).toBeNull();
  });

  it('detects changed values with mixed added/removed/changed keys', async () => {
    const { diff } = await import('../audit');
    const result = diff({ a: 1, b: 2, c: 3 }, { b: 4, c: 3, d: 5 });
    expect(result).toEqual({
      a: { old: 1, new: undefined },
      b: { old: 2, new: 4 },
      d: { old: undefined, new: 5 },
    });
  });
});

describe('writeAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls prisma.adminAuditLog.create with correct data', async () => {
    const { writeAuditLog } = await import('../audit');
    const { prisma } = await import('~/lib/prisma');

    await writeAuditLog({
      userId: 'user-1',
      action: 'test-action',
      oldValue: { name: 'Old' },
      newValue: { name: 'New' },
    });

    expect(prisma.adminAuditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        eventId: undefined,
        action: 'test-action',
        oldValue: { name: 'Old' },
        newValue: { name: 'New' },
      },
    });
  });

  it('passes eventId when provided', async () => {
    const { writeAuditLog } = await import('../audit');
    const { prisma } = await import('~/lib/prisma');

    await writeAuditLog({
      userId: 'user-1',
      eventId: 'event-1',
      action: 'update-event',
    });

    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        eventId: 'event-1',
        action: 'update-event',
        oldValue: undefined,
        newValue: undefined,
      },
    });
  });

  it('handles missing oldValue and newValue', async () => {
    const { writeAuditLog } = await import('../audit');
    const { prisma } = await import('~/lib/prisma');

    await writeAuditLog({
      userId: 'user-1',
      action: 'delete-event',
    });

    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        eventId: undefined,
        action: 'delete-event',
        oldValue: undefined,
        newValue: undefined,
      },
    });
  });
});
