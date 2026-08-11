import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * FPP-104: complete per-event host scoping.
 *
 * Locks in the cross-file contract for the per-event admin gate
 * applied to potluck, RSVP, and event-lifecycle surfaces. Each
 * `describe` block reads the relevant source files and asserts on
 * the gate used by each route / tRPC procedure, so a regression
 * that re-introduces a global `requireAdminApi` / `auditedAdminProcedure`
 * on a per-event surface would be caught here.
 *
 * The matching behaviour tests live in:
 *   - `src/lib/__tests__/event-access.test.ts` (the helper)
 *   - `src/app/api/admin/potluck-slots/__tests__/route.test.ts`
 *   - `src/app/api/admin/events/__tests__/event-detail.test.ts`
 *   - `src/app/api/admin/events/[id]/{publish,close,cancel}/__tests__/`
 *   - `src/app/api/admin/rsvp/override/__tests__/route.test.ts`
 *   - `src/server/routers/__tests__/routers.test.ts`
 *   - `src/app/api/admin/events/[id]/admins/__tests__/route.test.ts`
 *     (self-assignment guard tightening)
 */
describe('FPP-104: complete per-event host scoping', () => {
  const eventAccessPath = path.join(process.cwd(), 'src/lib/event-access.ts');
  const trpcPath = path.join(process.cwd(), 'src/lib/trpc.ts');

  // REST surfaces.
  const potluckSlotsCreatePath = path.join(
    process.cwd(),
    'src/app/api/admin/potluck-slots/route.ts',
  );
  const potluckSlotsIdPath = path.join(
    process.cwd(),
    'src/app/api/admin/potluck-slots/[id]/route.ts',
  );
  const eventDetailPath = path.join(process.cwd(), 'src/app/api/admin/events/[id]/route.ts');
  const eventPublishPath = path.join(
    process.cwd(),
    'src/app/api/admin/events/[id]/publish/route.ts',
  );
  const eventClosePath = path.join(process.cwd(), 'src/app/api/admin/events/[id]/close/route.ts');
  const eventCancelPath = path.join(process.cwd(), 'src/app/api/admin/events/[id]/cancel/route.ts');
  const rsvpOverridePath = path.join(process.cwd(), 'src/app/api/admin/rsvp/override/route.ts');

  // Invitations + communications + audit + CSV + users/search stay
  // super-admin only (per the FPP-104 "arguably keep" list).
  const invitationsSendPath = path.join(
    process.cwd(),
    'src/app/api/admin/invitations/send/route.ts',
  );
  const invitationsResendPath = path.join(
    process.cwd(),
    'src/app/api/admin/invitations/resend/route.ts',
  );
  const invitationsTrackPath = path.join(
    process.cwd(),
    'src/app/api/admin/invitations/track/route.ts',
  );
  const communicationsSendPath = path.join(
    process.cwd(),
    'src/app/api/admin/communications/send/route.ts',
  );
  const auditLogPath = path.join(process.cwd(), 'src/app/api/admin/audit-log/route.ts');
  const csvImportPath = path.join(process.cwd(), 'src/app/api/admin/csv-import/route.ts');
  const usersSearchPath = path.join(process.cwd(), 'src/app/api/admin/users/search/route.ts');
  const eventsListPath = path.join(process.cwd(), 'src/app/api/admin/events/route.ts');

  // tRPC routers.
  const potluckRouterPath = path.join(process.cwd(), 'src/server/routers/potluck.router.ts');
  const rsvpRouterPath = path.join(process.cwd(), 'src/server/routers/rsvp.router.ts');
  const invitationRouterPath = path.join(process.cwd(), 'src/server/routers/invitation.router.ts');
  const eventRouterPath = path.join(process.cwd(), 'src/server/routers/event.router.ts');

  // Self-assignment guard.
  const eventAdminsPostPath = path.join(
    process.cwd(),
    'src/app/api/admin/events/[id]/admins/route.ts',
  );

  // Minor cleanup.
  const itinerarySchemaPath = path.join(process.cwd(), 'src/lib/schemas/itinerary.ts');

  describe('shared per-event helpers', () => {
    it('event-access.ts still exposes canAccessEvent and requireEventAccess', async () => {
      const lib = await fs.readFile(eventAccessPath, 'utf-8');
      expect(lib).toMatch(/export async function canAccessEvent/);
      expect(lib).toMatch(/export async function requireEventAccess/);
    });

    it('eventAdminProcedure builder remains in trpc.ts', async () => {
      const trpc = await fs.readFile(trpcPath, 'utf-8');
      expect(trpc).toMatch(/export function eventAdminProcedure/);
    });
  });

  describe('1. potluck slots — REST + tRPC moved to per-event gate', () => {
    it('REST POST /api/admin/potluck-slots uses requireEventAdminApi', async () => {
      const route = await fs.readFile(potluckSlotsCreatePath, 'utf-8');
      expect(route).toMatch(/requireEventAdminApi/);
      expect(route).not.toMatch(/requireAdminApi\(\)/);
    });

    it('REST PATCH/DELETE /api/admin/potluck-slots/[id] use requireEventAdminApi', async () => {
      const route = await fs.readFile(potluckSlotsIdPath, 'utf-8');
      expect(route).toMatch(/requireEventAdminApi/);
      expect(route).not.toMatch(/requireAdminApi\(\)/);
    });

    it('REST PATCH/DELETE look the slot up first to resolve the eventId', async () => {
      // The per-event gate is keyed on the parent event, so the
      // route must look the slot up before calling
      // `requireEventAdminApi`. The audit fixes the missing
      // try/catch around the lookup. The local var is named
      // `lookup` (not `slot`) so the eslint `no-useless-assignment`
      // rule does not flag the assignment as dead. The second
      // arg (`{ preloadedSession }`) is optional — the regex
      // accepts either form.
      const route = await fs.readFile(potluckSlotsIdPath, 'utf-8');
      expect(route).toMatch(/potluckSlot\.findUnique/);
      expect(route).toMatch(/requireEventAdminApi\(\s*lookup\.eventId/);
    });

    it('REST PATCH/DELETE close the 404-vs-401 information leak with requireSessionApi', async () => {
      // FPP-104 review: an unauthenticated caller must see 401
      // before any DB read, so probing slot ids cannot distinguish
      // "missing slot" from "no per-event access". The
      // `requireSessionApi` helper runs first, then the slot
      // lookup, then `requireEventAdminApi` (with the preloaded
      // session to avoid a second `getServerSession` call).
      const route = await fs.readFile(potluckSlotsIdPath, 'utf-8');
      expect(route).toMatch(/requireSessionApi/);
      // The session check must happen before the slot lookup so
      // the leak is closed. Look for `requireSessionApi` and
      // `potluckSlot.findUnique` in the same file, with the
      // session check first in the function bodies.
      const patchBody = route.match(/export async function PATCH[\s\S]*?^\}/m);
      const deleteBody = route.match(/export async function DELETE[\s\S]*?^\}/m);
      expect(patchBody).not.toBeNull();
      expect(deleteBody).not.toBeNull();
      const sessionIdx = patchBody![0]!.indexOf('requireSessionApi');
      const lookupIdx = patchBody![0]!.indexOf('potluckSlot.findUnique');
      expect(sessionIdx).toBeGreaterThan(-1);
      expect(lookupIdx).toBeGreaterThan(-1);
      expect(sessionIdx).toBeLessThan(lookupIdx);
      const sessionIdxD = deleteBody![0]!.indexOf('requireSessionApi');
      const lookupIdxD = deleteBody![0]!.indexOf('potluckSlot.findUnique');
      expect(sessionIdxD).toBeLessThan(lookupIdxD);
    });

    it('tRPC potluck.createSlot is eventAdminProcedure keyed on input.eventId', async () => {
      const router = await fs.readFile(potluckRouterPath, 'utf-8');
      expect(router).toMatch(/createSlot:\s*eventAdminProcedure/);
      expect(router).not.toMatch(/createSlot:\s*auditedAdminProcedure/);
    });

    it('tRPC potluck.updateSlot + deleteSlot use eventAdminProcedure with a getEventId lookup', async () => {
      // The input is `{ id }` only, so the builder's getEventId
      // resolver must look the slot up to find the parent event.
      const router = await fs.readFile(potluckRouterPath, 'utf-8');
      expect(router).toMatch(/updateSlot:\s*eventAdminProcedure/);
      expect(router).toMatch(/deleteSlot:\s*eventAdminProcedure/);
      expect(router).not.toMatch(/updateSlot:\s*auditedAdminProcedure/);
      expect(router).not.toMatch(/deleteSlot:\s*auditedAdminProcedure/);
    });
  });

  describe('2. event lifecycle — REST publish/close/cancel + PATCH/DELETE on /events/[id]', () => {
    it('REST PATCH /api/admin/events/[id] uses requireEventAdminApi', async () => {
      const route = await fs.readFile(eventDetailPath, 'utf-8');
      expect(route).toMatch(/requireEventAdminApi/);
    });

    it('REST DELETE /api/admin/events/[id] uses requireEventAdminApi', async () => {
      const route = await fs.readFile(eventDetailPath, 'utf-8');
      // Both PATCH and DELETE on the event-detail file use
      // requireEventAdminApi; the GET stays global because the
      // host surface is the dedicated event-edit page.
      expect(route).toMatch(/requireEventAdminApi/);
    });

    it('REST GET /api/admin/events/[id] stays global-admin only', async () => {
      // GET is intentionally not per-event-gated — the host
      // surface is the dedicated event-edit page (which already
      // routes through requireEventAdminPage). Keeping GET global
      // stops a host from enumerating events by id.
      const route = await fs.readFile(eventDetailPath, 'utf-8');
      const getBlock = route.match(/export async function GET[\s\S]*?\}\s*$/m);
      expect(getBlock).not.toBeNull();
      expect(getBlock![0]!).toMatch(/requireAdminApi/);
    });

    it('REST publish/close/cancel use requireEventAdminApi', async () => {
      for (const p of [eventPublishPath, eventClosePath, eventCancelPath]) {
        const route = await fs.readFile(p, 'utf-8');
        expect(route).toMatch(/requireEventAdminApi/);
        expect(route).not.toMatch(/requireAdminApi\(\)/);
      }
    });
  });

  describe('3. RSVP override — REST + tRPC moved to per-event gate', () => {
    it('REST POST /api/admin/rsvp/override uses requireEventAdminApi (gated on parsed eventId)', async () => {
      const route = await fs.readFile(rsvpOverridePath, 'utf-8');
      expect(route).toMatch(/requireEventAdminApi/);
      expect(route).not.toMatch(/requireAdminApi\(\)/);
      // The gate runs on `input.eventId` after the schema parse.
      expect(route).toMatch(/requireEventAdminApi\(input\.eventId\)/);
    });

    it('tRPC rsvp.adminOverride is eventAdminProcedure keyed on input.eventId', async () => {
      const router = await fs.readFile(rsvpRouterPath, 'utf-8');
      expect(router).toMatch(/adminOverride:\s*eventAdminProcedure/);
      expect(router).not.toMatch(/adminOverride:\s*auditedAdminProcedure/);
    });

    it('tRPC rsvp.getById is eventAdminProcedure with a getEventId resolver', async () => {
      const router = await fs.readFile(rsvpRouterPath, 'utf-8');
      expect(router).toMatch(/getById:\s*eventAdminProcedure/);
      expect(router).not.toMatch(/getById:\s*auditedAdminProcedure/);
    });

    it('tRPC rsvp.getById throws TRPCError NOT_FOUND for a missing RSVP (no empty-string fallback)', async () => {
      // FPP-104 review: the getEventId resolver must throw
      // NOT_FOUND when the RSVP is missing, not return an empty
      // string and let the gate 403. The empty-string fallback
      // was a code smell that relied on `canAccessEvent` always
      // returning false for `eventId: ''` — silently fragile if
      // the helper ever changes.
      const router = await fs.readFile(rsvpRouterPath, 'utf-8');
      // The resolver block must throw inside `getById:`'s
      // getEventId closure, not return ''.
      const block = router.match(/getById:[\s\S]*?\}\)\.query/);
      expect(block).not.toBeNull();
      expect(block![0]!).toMatch(/getById:[\s\S]*?NOT_FOUND/);
      // Defensive: the old empty-string fallback must be gone.
      expect(block![0]!).not.toMatch(/rsvp\?\.eventId\s*\?\?\s*['"]['"]/);
    });

    it('tRPC rsvp.getByEvent is eventAdminProcedure keyed on input.eventId', async () => {
      const router = await fs.readFile(rsvpRouterPath, 'utf-8');
      expect(router).toMatch(/getByEvent:\s*eventAdminProcedure/);
      expect(router).not.toMatch(/getByEvent:\s*auditedAdminProcedure/);
    });
  });

  describe('4. invitation + communication + audit + CSV + users/search remain super-admin', () => {
    // Per the FPP-104 "arguably keep" list, the broadcast /
    // enumeration surfaces stay super-admin only. The audit
    // catches any regression that downgrades them to per-event.
    const paths = [
      invitationsSendPath,
      invitationsResendPath,
      invitationsTrackPath,
      communicationsSendPath,
      auditLogPath,
      csvImportPath,
      usersSearchPath,
      eventsListPath,
    ];
    for (const p of paths) {
      it(`${p.split('/').pop()} keeps the global requireAdminApi gate`, async () => {
        const route = await fs.readFile(p, 'utf-8');
        // Global gate remains. The exact helper is `requireAdminApi`
        // for REST; the matching tRPC builders stay
        // `auditedAdminProcedure` (covered by the next describe).
        expect(route).toMatch(/requireAdminApi/);
        expect(route).not.toMatch(/requireEventAdminApi/);
      });
    }

    it('tRPC invitation.send / resend / trackDelivery / getByEvent stay auditedAdminProcedure', async () => {
      const router = await fs.readFile(invitationRouterPath, 'utf-8');
      const procedures = [
        /send:\s*auditedAdminProcedure/,
        /resend:\s*auditedAdminProcedure/,
        /trackDelivery:\s*auditedAdminProcedure/,
        /getByEvent:\s*auditedAdminProcedure/,
        /getByHousehold:\s*auditedAdminProcedure/,
      ];
      for (const pattern of procedures) {
        expect(router).toMatch(pattern);
      }
      // Defensive: no invitation proc was downgraded.
      expect(router).not.toMatch(/send:\s*eventAdminProcedure/);
      expect(router).not.toMatch(/resend:\s*eventAdminProcedure/);
      expect(router).not.toMatch(/trackDelivery:\s*eventAdminProcedure/);
    });

    it('event.router.ts keeps the per-event tRPC procs on eventAdminProcedure', async () => {
      // FPP-65 / FPP-104: event.update, publish, close, cancel,
      // listAdmins, addAdmin, removeAdmin all stay per-event-gated.
      const router = await fs.readFile(eventRouterPath, 'utf-8');
      const procedures = [
        /update:\s*eventAdminProcedure/,
        /publish:\s*eventAdminProcedure/,
        /close:\s*eventAdminProcedure/,
        /cancel:\s*eventAdminProcedure/,
        /listAdmins:\s*eventAdminProcedure/,
        /addAdmin:\s*eventAdminProcedure/,
        /removeAdmin:\s*eventAdminProcedure/,
      ];
      for (const pattern of procedures) {
        expect(router).toMatch(pattern);
      }
    });
  });

  describe('5. self-assignment guard tightened to isSuperAdminRole', () => {
    it('REST POST /api/admin/events/[id]/admins uses isSuperAdminRole (FPP-104)', async () => {
      const route = await fs.readFile(eventAdminsPostPath, 'utf-8');
      // FPP-104 followup: the previous guard used isAdminRole,
      // which let an ADMIN_ADULT user through. The check is now
      // `isSuperAdminRole` so only platform-level super-admins
      // can self-assign.
      const actorCheck = route.match(/const actorIsSuperAdmin[\s\S]*?\);/);
      expect(actorCheck).not.toBeNull();
      expect(actorCheck![0]!).toMatch(/isSuperAdminRole/);
      expect(actorCheck![0]!).not.toMatch(/isAdminRole/);
    });
  });

  describe('6. cleanup: dead code removed from itinerary schema', () => {
    it('timeFieldSchema const is no longer exported or referenced', async () => {
      // FPP-45 followup: the unused `timeFieldSchema` const was
      // dead code (FPP-104 cleanup). The update schema
      // (timeUpdateFieldSchema) is still in use.
      const schema = await fs.readFile(itinerarySchemaPath, 'utf-8');
      expect(schema).not.toMatch(/const timeFieldSchema/);
      expect(schema).toMatch(/const timeUpdateFieldSchema/);
    });
  });
});
