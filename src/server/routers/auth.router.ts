import { router, protectedProcedure } from '~/lib/trpc';

export const authRouter = router({
  getSession: protectedProcedure.query(({ ctx }) => {
    return ctx.session;
  }),
});
