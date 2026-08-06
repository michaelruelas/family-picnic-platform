/**
 * Convert a Prisma `Charge` (with the eager-loaded relations used by
 * /admin/charges) into the serialized shape the client components expect.
 *
 * Lives in `~/lib/` because the same conversion is needed twice:
 *   1. The server page (`app/admin/charges/page.tsx`) serializes the
 *      initial result before passing to the client component.
 *   2. The client component refreshes via tRPC and needs to serialize
 *      again to keep types stable.
 *
 * Tolerates `Date | string` for every timestamp field, so the same
 * function works on Prisma Date instances (server) and on the
 * superjson-hydrated Date instances that come back from tRPC (client).
 */

type DateLike = Date | string;
type NullableDateLike = Date | string | null;

interface RefundLike {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  reason: string | null;
  createdAt: DateLike;
  updatedAt: DateLike;
  refundedBy: { id: string; name: string };
}

interface RegistrationLike {
  id: string;
  status: string;
  refundedCents: number;
  createdAt: DateLike;
  updatedAt: DateLike;
  user: { id: string; name: string; email: string };
  event: { id: string; name: string; date: DateLike };
}

export interface ChargeLike {
  id: string;
  registrationId: string;
  stripePaymentIntentId: string;
  amountCents: number;
  currency: string;
  status: string;
  receiptUrl: string | null;
  receiptSentAt: NullableDateLike;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: DateLike;
  updatedAt: DateLike;
  registration: RegistrationLike;
  refunds: RefundLike[];
}

function toIso(value: DateLike): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toIsoOrNull(value: NullableDateLike): string | null {
  if (value === null || value === undefined) return null;
  return toIso(value);
}

export function serializeCharge(c: ChargeLike): AdminChargeSerialized {
  return {
    id: c.id,
    registrationId: c.registrationId,
    stripePaymentIntentId: c.stripePaymentIntentId,
    amountCents: c.amountCents,
    currency: c.currency,
    status: c.status,
    receiptUrl: c.receiptUrl,
    receiptSentAt: toIsoOrNull(c.receiptSentAt),
    lastErrorCode: c.lastErrorCode,
    lastErrorMessage: c.lastErrorMessage,
    createdAt: toIso(c.createdAt),
    updatedAt: toIso(c.updatedAt),
    registration: {
      id: c.registration.id,
      status: c.registration.status,
      refundedCents: c.registration.refundedCents,
      createdAt: toIso(c.registration.createdAt),
      updatedAt: toIso(c.registration.updatedAt),
      user: c.registration.user,
      event: {
        id: c.registration.event.id,
        name: c.registration.event.name,
        date: toIso(c.registration.event.date),
      },
    },
    refunds: c.refunds.map((r) => ({
      id: r.id,
      amountCents: r.amountCents,
      currency: r.currency,
      status: r.status,
      reason: r.reason,
      createdAt: toIso(r.createdAt),
      updatedAt: toIso(r.updatedAt),
      refundedBy: r.refundedBy,
    })),
  };
}

export interface AdminChargeSerialized {
  id: string;
  registrationId: string;
  stripePaymentIntentId: string;
  amountCents: number;
  currency: string;
  status: string;
  receiptUrl: string | null;
  receiptSentAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  registration: {
    id: string;
    status: string;
    refundedCents: number;
    createdAt: string;
    updatedAt: string;
    user: { id: string; name: string; email: string };
    event: { id: string; name: string; date: string };
  };
  refunds: Array<{
    id: string;
    amountCents: number;
    currency: string;
    status: string;
    reason: string | null;
    createdAt: string;
    updatedAt: string;
    refundedBy: { id: string; name: string };
  }>;
}
