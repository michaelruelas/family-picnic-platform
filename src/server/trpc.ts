import { createTRPCContext } from '~/lib/trpc';
import { appRouter } from './routers/_app';

export const caller = appRouter.createCaller(createTRPCContext);
