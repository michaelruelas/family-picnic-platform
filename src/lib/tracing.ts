import { AsyncLocalStorage } from 'async_hooks';
import { generateRequestId } from './logger';

export interface TraceContext {
  requestId: string;
  userId?: string;
  route?: string;
}

const traceStorage = new AsyncLocalStorage<TraceContext>();

export function getTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}

export function runWithTraceContext<T>(context: TraceContext, fn: () => T): T {
  return traceStorage.run(context, fn);
}

export function createTraceContext(
  requestId?: string,
  userId?: string,
  route?: string,
): TraceContext {
  return {
    requestId: requestId || generateRequestId(),
    userId,
    route,
  };
}

export function getCurrentRequestId(): string | undefined {
  return getTraceContext()?.requestId;
}

export function getCurrentUserId(): string | undefined {
  return getTraceContext()?.userId;
}
