import { Prisma } from '~/lib/generated/client';

const SERIALIZATION_FAILURE = 'P2034';

export interface SerializableRetryOptions {
  /** Maximum attempts before giving up. Default: 3. */
  maxAttempts?: number;
  /** Base delay between attempts in ms (doubled each retry). Default: 25. */
  baseDelayMs?: number;
  /** Called before each retry, with the attempt number that just failed. */
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Postgres returns `P2034` ("A write failed because a serialization
 * conflict occurred") when a Serializable transaction's snapshot lost
 * the race against a concurrent commit. Postgres aborted the whole
 * transaction, so we can safely retry the whole function body.
 *
 * Use this around procedures that take Serializable-isolation
 * transactions: createPaymentIntent, admin.refund.
 */
export function isSerializationFailure(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === SERIALIZATION_FAILURE;
  }
  // Duck-type fallback for tests that construct a plain error object
  // instead of importing the Prisma class.
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === SERIALIZATION_FAILURE
  );
}

export async function withSerializableRetry<T>(
  fn: () => Promise<T>,
  opts: SerializableRetryOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 25;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isSerializationFailure(err)) throw err;
      if (attempt < maxAttempts) {
        opts.onRetry?.(attempt, err);
        const delay = baseDelayMs * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
