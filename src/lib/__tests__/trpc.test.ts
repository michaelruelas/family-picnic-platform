import { describe, it, expect } from 'vitest';
import { TRPCError } from '@trpc/server';
import { procedure, protectedProcedure, adminProcedure, router } from '../trpc';
import { z } from 'zod';
import type { Role } from '~/lib/generated/enums';

describe('tRPC setup', () => {
  it('creates a public procedure that works without auth', async () => {
    const greeter = procedure
      .input(z.object({ name: z.string() }))
      .query(({ input }) => `Hello, ${input.name}`);

    const r = router({ greeter });
    const caller = r.createCaller({ session: null });

    await expect(caller.greeter({ name: 'Alice' })).resolves.toBe('Hello, Alice');
  });

  it('throws UNAUTHORIZED when calling a protected procedure without a session', async () => {
    const secret = protectedProcedure.query(() => 'top-secret');

    const r = router({ secret });
    const caller = r.createCaller({ session: null });

    await expect(caller.secret()).rejects.toThrow(TRPCError);
    await expect(caller.secret()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('allows authenticated users through protected procedures', async () => {
    const secret = protectedProcedure.query(() => 'top-secret');

    const r = router({ secret });
    const fakeSession = {
      user: {
        id: '1',
        name: 'Test',
        email: 'a@b.com',
        role: 'ADMIN_ADULT' as Role,
        householdId: null,
      },
      expires: 'x',
    };
    const caller = r.createCaller({ session: fakeSession });

    await expect(caller.secret()).resolves.toBe('top-secret');
  });

  it('throws FORBIDDEN for non-admin users on admin procedures', async () => {
    const adminOnly = adminProcedure.query(() => 'admin-secret');

    const r = router({ adminOnly });
    const userSession = {
      user: {
        id: '1',
        name: 'Test',
        email: 'a@b.com',
        role: 'ADMIN_ADULT' as Role,
        householdId: null,
      },
      expires: 'x',
    };
    const caller = r.createCaller({ session: userSession });

    await expect(caller.adminOnly()).rejects.toThrow(TRPCError);
    await expect(caller.adminOnly()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows admin users through admin procedures', async () => {
    const adminOnly = adminProcedure.query(() => 'admin-secret');

    const r = router({ adminOnly });
    const adminSession = {
      user: {
        id: '2',
        name: 'Admin',
        email: 'admin@x.com',
        role: 'ADMIN' as Role,
        householdId: null,
      },
      expires: 'x',
    };
    const caller = r.createCaller({ session: adminSession });

    await expect(caller.adminOnly()).resolves.toBe('admin-secret');
  });

  it('throws TRPCError on Zod validation failure', async () => {
    const ageCheck = procedure
      .input(z.object({ age: z.number().min(18) }))
      .query(({ input }) => input.age);

    const r = router({ ageCheck });
    const caller = r.createCaller({ session: null });

    await expect(caller.ageCheck({ age: 10 })).rejects.toThrow(TRPCError);
    await expect(caller.ageCheck({ age: 10 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
