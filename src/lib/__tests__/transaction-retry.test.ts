import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isSerializationFailure, withSerializableRetry } from '../transaction-retry';

describe('isSerializationFailure', () => {
  it('matches Prisma error class with code P2034', () => {
    // Mimic the Prisma error shape without importing the class so this
    // test stays decoupled from the generated client.
    class FakePrismaError extends Error {
      code = 'P2034';
      constructor() {
        super('serialization failure');
      }
    }
    const err = new FakePrismaError();
    expect(isSerializationFailure(err)).toBe(true);
  });

  it('rejects non-P2034 Prisma errors', () => {
    class FakePrismaError extends Error {
      code = 'P2002';
      constructor() {
        super('unique constraint');
      }
    }
    expect(isSerializationFailure(new FakePrismaError())).toBe(false);
  });

  it('accepts plain objects with code P2034 (test convenience)', () => {
    expect(isSerializationFailure({ code: 'P2034', message: 'x' })).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isSerializationFailure(null)).toBe(false);
    expect(isSerializationFailure(undefined)).toBe(false);
  });

  it('rejects errors without a code property', () => {
    expect(isSerializationFailure(new Error('boom'))).toBe(false);
  });
});

describe('withSerializableRetry', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('returns the value from the first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withSerializableRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on P2034 then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ code: 'P2034', message: 'race 1' })
      .mockResolvedValueOnce('ok');
    const result = await withSerializableRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries up to maxAttempts then throws the last P2034', async () => {
    const err = { code: 'P2034', message: 'lost the race' };
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withSerializableRetry(fn, { maxAttempts: 3 })).rejects.toEqual(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-P2034 errors', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');
    await expect(withSerializableRetry(fn)).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('invokes onRetry with the attempt number that just failed', async () => {
    const err1 = { code: 'P2034', message: 'race 1' };
    const err2 = { code: 'P2034', message: 'race 2' };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(err1)
      .mockRejectedValueOnce(err2)
      .mockResolvedValueOnce('ok');
    const onRetry = vi.fn();
    await withSerializableRetry(fn, { onRetry });
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, err1);
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, err2);
  });
});