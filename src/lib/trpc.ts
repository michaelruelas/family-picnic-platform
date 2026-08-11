import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Session } from 'next-auth';
import type { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminRole } from './auth';
import { writeAuditLog } from './audit';
import { canAccessEvent } from './event-access';

interface Ctx {
  session: Session | null;
  // Forwarded by the tRPC fetch adapter so procedures can stamp
  // audit metadata (e.g. the IP captured at SMS consent time).
  headers?: Headers;
}

interface AuthedCtx {
  session: Session;
}

const t = initTRPC.context<Ctx>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session as Session,
    } as AuthedCtx,
  });
});

// Must run after `isAuthenticated` so `ctx.session.user` is non-nullable.
const isAdmin = t.middleware(({ ctx, next }) => {
  const authedCtx = ctx as AuthedCtx;
  if (!isAdminRole(authedCtx.session.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({
    ctx: authedCtx,
  });
});

const auditLog = t.middleware(async ({ ctx, next, type, path }) => {
  const authedCtx = ctx as AuthedCtx;
  const result = await next({ ctx: authedCtx });

  if (type === 'mutation' && path) {
    await writeAuditLog({
      userId: authedCtx.session.user.id,
      action: path,
    });
  }

  return result;
});

export const createCallerFactory = t.createCallerFactory;

export const procedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthenticated);
export const adminProcedure = t.procedure.use(isAuthenticated).use(isAdmin);
export const auditedAdminProcedure = t.procedure.use(isAuthenticated).use(isAdmin).use(auditLog);
export const router = t.router;

/**
 * FPP-65 / QUB-13.1: per-event-scoped admin procedure builder.
 *
 * Replaces `auditedAdminProcedure` for procedures that act on a
 * single event (event.update, event.publish, event.addAdmin, ...).
 * Allows the caller through if EITHER:
 *   - they pass `isAdminRole(...)` (platform-level super-admin or
 *     adult-family user with the legacy pre-FPP-65 admin perks), OR
 *   - they have an EventAdmin row for the event (host, co-admin, or
 *     inviter — `canAccessEvent` short-circuits super-admins too).
 *
 * The HOST role is intentionally NOT in `ADMIN_ROLES` after the
 * FPP-65 audit, so a host cannot reach this builder through the
 * global admin gate. `canAccessEvent` is the only way they get in.
 *
 * `getEventId` extracts the event id from the parsed input. Most
 * procedures use `input.eventId` (e.g. addAdmin, removeAdmin); the
 * event-mutation procedures use `input.id` (e.g. update, publish).
 * FPP-104 also accepts a `Promise<string>` so a procedure that
 * keys on a sub-resource id (e.g. `rsvp.getById` resolving the
 * parent event from the rsvp id) can do a single Prisma lookup
 * inside the gate.
 *
 * The `auditLog` middleware runs after the per-event check so a
 * 403 never writes an audit row.
 */
export function eventAdminProcedure<TInput extends z.ZodTypeAny>(
  inputSchema: TInput,
  getEventId: (input: z.infer<TInput>) => string | Promise<string>,
) {
  // NOTE: tRPC's `input` here is `inferParser<TInput>["out"]` which
  // is structurally identical to `z.infer<TInput>` but TypeScript
  // treats them as distinct. We cast inside the middleware to
  // bridge the two so the caller can write a schema-typed
  // extractor without seeing the mismatch.
  return protectedProcedure
    .input(inputSchema)
    .use(async ({ ctx, input, next }) => {
      const role = ctx.session.user.role;
      const eventId = await getEventId(input as z.infer<TInput>);
      const allowed = isAdminRole(role) || (await canAccessEvent(ctx.session, eventId));
      if (!allowed) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return next({ ctx: ctx as AuthedCtx });
    })
    .use(auditLog);
}

export async function createTRPCContext(opts?: { headers?: Headers }) {
  const session = await getServerSession(authOptions);
  return { session, ...opts };
}
