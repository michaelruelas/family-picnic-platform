import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { appRouter } from '~/server/routers/_app';
import { createTRPCContext } from '~/lib/trpc';

export async function createContext(opts: FetchCreateContextFnOptions) {
  return createTRPCContext({ headers: opts.req.headers });
}

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
