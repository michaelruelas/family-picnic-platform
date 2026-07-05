import { describe, it, expect, vi } from 'vitest';

vi.mock('../logger', () => ({
  generateRequestId: vi.fn(() => 'req_mocked_abc123'),
}));

describe('tracing', () => {
  describe('createTraceContext', () => {
    it('creates an object with requestId', async () => {
      const { createTraceContext } = await import('../tracing');
      const ctx = createTraceContext();
      expect(ctx).toHaveProperty('requestId');
      expect(typeof ctx.requestId).toBe('string');
    });

    it('uses provided requestId when given', async () => {
      const { createTraceContext } = await import('../tracing');
      const ctx = createTraceContext('my-req-1');
      expect(ctx.requestId).toBe('my-req-1');
    });

    it('generates requestId when not provided', async () => {
      const { createTraceContext } = await import('../tracing');
      const ctx = createTraceContext();
      expect(ctx.requestId).toBe('req_mocked_abc123');
    });

    it('accepts optional userId', async () => {
      const { createTraceContext } = await import('../tracing');
      const ctx = createTraceContext('req-1', 'user-42');
      expect(ctx.userId).toBe('user-42');
    });

    it('accepts optional route', async () => {
      const { createTraceContext } = await import('../tracing');
      const ctx = createTraceContext('req-1', 'user-42', '/api/events');
      expect(ctx.route).toBe('/api/events');
    });

    it('leaves userId and route undefined when not provided', async () => {
      const { createTraceContext } = await import('../tracing');
      const ctx = createTraceContext('req-1');
      expect(ctx.userId).toBeUndefined();
      expect(ctx.route).toBeUndefined();
    });
  });

  describe('runWithTraceContext and getTraceContext', () => {
    it('stores and retrieves context via getTraceContext', async () => {
      const { runWithTraceContext, getTraceContext } = await import('../tracing');
      const context = { requestId: 'req-1', userId: 'user-1', route: '/test' };
      let captured: any;
      runWithTraceContext(context, () => {
        captured = getTraceContext();
      });
      expect(captured).toEqual(context);
    });

    it('returns undefined for getTraceContext outside runWithTraceContext', async () => {
      const { getTraceContext } = await import('../tracing');
      expect(getTraceContext()).toBeUndefined();
    });

    it('properly isolates context between different runs', async () => {
      const { runWithTraceContext, getTraceContext } = await import('../tracing');
      const results: any[] = [];

      runWithTraceContext({ requestId: 'req-1' }, () => {
        results.push(getTraceContext());
        runWithTraceContext({ requestId: 'req-2' }, () => {
          results.push(getTraceContext());
        });
        results.push(getTraceContext());
      });

      expect(results[0]!.requestId).toBe('req-1');
      expect(results[1]!.requestId).toBe('req-2');
      expect(results[2]!.requestId).toBe('req-1');
    });
  });

  describe('getCurrentRequestId', () => {
    it('returns requestId from context', async () => {
      const { runWithTraceContext, getCurrentRequestId } = await import('../tracing');
      let result: string | undefined;
      runWithTraceContext({ requestId: 'req-42' }, () => {
        result = getCurrentRequestId();
      });
      expect(result).toBe('req-42');
    });

    it('returns undefined when no context', async () => {
      const { getCurrentRequestId } = await import('../tracing');
      expect(getCurrentRequestId()).toBeUndefined();
    });
  });

  describe('getCurrentUserId', () => {
    it('returns userId from context', async () => {
      const { runWithTraceContext, getCurrentUserId } = await import('../tracing');
      let result: string | undefined;
      runWithTraceContext({ requestId: 'req-1', userId: 'user-99' }, () => {
        result = getCurrentUserId();
      });
      expect(result).toBe('user-99');
    });

    it('returns undefined when userId is not set', async () => {
      const { runWithTraceContext, getCurrentUserId } = await import('../tracing');
      let result: string | undefined;
      runWithTraceContext({ requestId: 'req-1' }, () => {
        result = getCurrentUserId();
      });
      expect(result).toBeUndefined();
    });

    it('returns undefined when no context', async () => {
      const { getCurrentUserId } = await import('../tracing');
      expect(getCurrentUserId()).toBeUndefined();
    });
  });
});
