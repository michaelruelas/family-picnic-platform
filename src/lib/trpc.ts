import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { writeAuditLog } from './audit';

interface Ctx {
  session: Session | null;
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

const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  if (ctx.session.user.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session as Session,
    } as AuthedCtx,
  });
});

const auditLog = t.middleware(async ({ ctx, next, type, path }) => {
  const authedCtx = ctx as AuthedCtx;
  const result = await next({ ctx: authedCtx });

  if (type === 'mutation' && path) {
    const eventId = extractEventId(authedCtx, path);
    await writeAuditLog({
      userId: authedCtx.session.user.id,
      eventId,
      action: path,
    });
  }

  return result;
});

function extractEventId(ctx: Ctx | AuthedCtx, _path: string): string | undefined {
  if ('eventId' in ctx && typeof ctx.eventId === 'string') {
    return ctx.eventId;
  }
  return undefined;
}

export const createCallerFactory = t.createCallerFactory;

export const procedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthenticated);
export const adminProcedure = t.procedure.use(isAuthenticated).use(isAdmin);
export const auditedAdminProcedure = t.procedure.use(isAuthenticated).use(isAdmin).use(auditLog);
export const router = t.router;

export async function createTRPCContext(opts?: { headers?: Headers }) {
  const session = await getServerSession(authOptions);
  return { session, ...opts };
}
