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
        role: 'ADMIN' as Role,
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
        role: 'GUEST' as Role,
        householdId: null,
      },
      expires: 'x',
    };
    const caller = r.createCaller({ session: userSession });

    await expect(caller.adminOnly()).rejects.toThrow(TRPCError);
    await expect(caller.adminOnly()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows SUPER_ADMIN users through admin procedures', async () => {
    const adminOnly = adminProcedure.query(() => 'admin-secret');

    const r = router({ adminOnly });
    const adminSession = {
      user: {
        id: '2',
        name: 'Admin',
        email: 'admin@x.com',
        role: 'SUPER_ADMIN' as Role,
        householdId: null,
      },
      expires: 'x',
    };
    const caller = r.createCaller({ session: adminSession });

    await expect(caller.adminOnly()).resolves.toBe('admin-secret');
  });

  it('rejects HOST users through admin procedures (FPP-65 audit)', async () => {
    // FPP-65 audit: HOST is a per-event scoped role. Removing it
    // from ADMIN_ROLES means HOST users no longer unlock global
    // admin procedures — they must go through the per-event
    // `eventAdminProcedure` builder instead.
    const adminOnly = adminProcedure.query(() => 'admin-secret');

    const r = router({ adminOnly });
    const hostSession = {
      user: {
        id: '4',
        name: 'Host',
        email: 'host@x.com',
        role: 'HOST' as Role,
        householdId: 'house-2',
      },
      expires: 'x',
    };
    const caller = r.createCaller({ session: hostSession });

    await expect(caller.adminOnly()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows ADMIN users through admin procedures', async () => {
    const adminOnly = adminProcedure.query(() => 'admin-secret');

    const r = router({ adminOnly });
    const adultSession = {
      user: {
        id: '3',
        name: 'Adult',
        email: 'adult@x.com',
        role: 'ADMIN' as Role,
        householdId: 'house-1',
      },
      expires: 'x',
    };
    const caller = r.createCaller({ session: adultSession });

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
