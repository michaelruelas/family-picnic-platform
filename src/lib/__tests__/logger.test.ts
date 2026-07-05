import { describe, it, expect } from 'vitest';

describe('logger', () => {
  describe('generateRequestId', () => {
    it('returns a string starting with "req_"', async () => {
      const { generateRequestId } = await import('../logger');
      const id = generateRequestId();
      expect(id).toMatch(/^req_/);
    });

    it('produces unique values on successive calls', async () => {
      const { generateRequestId } = await import('../logger');
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
    });

    it('contains timestamp and random parts separated by underscore', async () => {
      const { generateRequestId } = await import('../logger');
      const id = generateRequestId();
      const parts = id.split('_');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('req');
      expect(parts[1]).toMatch(/^\d+$/);
      expect(parts[2]).toMatch(/^[0-9a-z]+$/);
    });
  });

  describe('createRequestLogger', () => {
    it('returns a logger object with expected methods', async () => {
      const { createRequestLogger } = await import('../logger');
      const childLogger = createRequestLogger({ requestId: 'test-123' });
      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe('function');
      expect(typeof childLogger.error).toBe('function');
      expect(typeof childLogger.warn).toBe('function');
      expect(typeof childLogger.debug).toBe('function');
      expect(typeof childLogger.child).toBe('function');
    });

    it('returns a different logger instance for different contexts', async () => {
      const { createRequestLogger } = await import('../logger');
      const logger1 = createRequestLogger({ requestId: 'req-1' });
      const logger2 = createRequestLogger({ requestId: 'req-2' });
      expect(logger1).not.toBe(logger2);
    });
  });

  describe('logger', () => {
    it('is defined and has expected level', async () => {
      const { logger } = await import('../logger');
      expect(logger).toBeDefined();
      expect(logger.level).toBeDefined();
    });

    it('has info, error, warn, debug methods', async () => {
      const { logger } = await import('../logger');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });
});
