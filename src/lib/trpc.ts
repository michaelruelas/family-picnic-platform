import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

interface Ctx {
  session: Session | null;
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
  return next({ ctx: { session: ctx.session } });
});

const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  if (ctx.session.user.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx: { session: ctx.session } });
});

export const createCallerFactory = t.createCallerFactory;

export const procedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthenticated);
export const adminProcedure = t.procedure.use(isAuthenticated).use(isAdmin);
export const router = t.router;

export async function createTRPCContext(opts?: { headers?: Headers }) {
  const session = await getServerSession(authOptions);
  return { session, ...opts };
}
