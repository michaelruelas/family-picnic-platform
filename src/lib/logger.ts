import pino from 'pino';

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export interface LogContext {
  requestId?: string;
  userId?: string;
  route?: string;
  eventId?: string;
  [key: string]: string | undefined;
}

export function createRequestLogger(context: LogContext) {
  return baseLogger.child(context);
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export const logger = baseLogger;
