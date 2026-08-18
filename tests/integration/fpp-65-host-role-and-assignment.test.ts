import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * FPP-65 / QUB-13: host role + assignment to events.
 *
 * Locks in the cross-file contract for the three sub-tickets:
 *   - 13.1 / FPP-42: super_admin + host roles in the auth + Role enum
 *   - 13.2 / FPP-41: host assignment UI for super admins (REST + tRPC)
 *   - 13.3 / FPP-40: host contact details on the public event page
 *
 * Each describe block is intentionally text/source-pattern based so
 * the test does not need a live database. The matching behaviour
 * tests live in:
 *   - `src/lib/__tests__/event-access.test.ts`
 *   - `src/app/api/admin/events/[id]/admins/__tests__/route.test.ts`
 *   - `src/lib/__tests__/trpc.test.ts`
 */
describe('FPP-65: host role and assignment to events', () => {
  const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
  const authLibPath = path.join(process.cwd(), 'src/lib/auth.ts');
  const eventAccessPath = path.join(process.cwd(), 'src/lib/event-access.ts');
  const trpcPath = path.join(process.cwd(), 'src/lib/trpc.ts');
  const adminsRoutePath = path.join(process.cwd(), 'src/app/api/admin/events/[id]/admins/route.ts');
  const eventAdminsClientPath = path.join(
    process.cwd(),
    'src/app/admin/events/[id]/edit/admins/EventAdminsClient.tsx',
  );
  const eventPagePath = path.join(process.cwd(), 'src/app/events/[id]/page.tsx');
  const eventHeaderSectionPath = path.join(
    process.cwd(),
    'src/components/event/EventHeaderSection.tsx',
  );
  const migrationPath = path.join(
    process.cwd(),
    'prisma/migrations/20260809090000_fpp65_super_admin_and_host_roles/migration.sql',
  );
  const eventRouterPath = path.join(process.cwd(), 'src/server/routers/event.router.ts');

  describe('FPP-42 / QUB-13.1 — role model', () => {
    it('declares SUPER_ADMIN, ADMIN, ADULT, and HOST on the Role enum', async () => {
      const schema = await fs.readFile(schemaPath, 'utf-8');
      const block = schema.match(/enum Role \{([\s\S]*?)^\}/m);
      expect(block).not.toBeNull();
      expect(block![1]!).toMatch(/SUPER_ADMIN/);
      expect(block![1]!).toMatch(/ADMIN/);
      expect(block![1]!).toMatch(/ADULT/);
      expect(block![1]!).toMatch(/HOST/);
    });

    it('migration adds SUPER_ADMIN and HOST to the Role enum and backfills ADMIN', async () => {
      const sql = await fs.readFile(migrationPath, 'utf-8');
      expect(sql).toMatch(/ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN'/);
      expect(sql).toMatch(/ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'HOST'/);
      // Backfill clause — every legacy `ADMIN` row becomes a
      // super-admin. No host auto-assignment is performed (the spec
      // is explicit about this).
      expect(sql).toMatch(/UPDATE "User"\s+SET "role" = 'SUPER_ADMIN'/);
      expect(sql).toMatch(/WHERE "role" = 'ADMIN'/);
      expect(sql).not.toMatch(/EventAdmin/);
    });

    it('exposes SUPER_ADMIN_ROLES for the strict super-admin check', async () => {
      const auth = await fs.readFile(authLibPath, 'utf-8');
      expect(auth).toMatch(/SUPER_ADMIN_ROLES:\s*readonly Role\[\]\s*=\s*\['SUPER_ADMIN'\]/);
      expect(auth).toMatch(/export function isSuperAdminRole/);
    });

    it('keeps isAdminRole strict (SUPER_ADMIN + ADMIN, no HOST)', async () => {
      // FPP-65 audit: HOST was a per-event scoped role, NOT a
      // global admin tier. Removing HOST from ADMIN_ROLES means a
      // host cannot unlock global admin access — they must go
      // through the per-event `eventAdminProcedure` builder.
      const auth = await fs.readFile(authLibPath, 'utf-8');
      expect(auth).toMatch(/ADMIN_ROLES:\s*readonly Role\[\]\s*=\s*\['SUPER_ADMIN',\s*'ADMIN'\]/);
      expect(auth).toMatch(/export function isAdminRole/);
    });
  });

  describe('FPP-42 / QUB-13.4 — host-scoped event access helper', () => {
    it('exposes canAccessEvent and requireEventAccess helpers', async () => {
      const lib = await fs.readFile(eventAccessPath, 'utf-8');
      expect(lib).toMatch(/export async function canAccessEvent/);
      expect(lib).toMatch(/export async function requireEventAccess/);
      expect(lib).toMatch(/export async function getEventRole/);
    });

    it('canAccessEvent short-circuits on super-admin without touching EventAdmin', async () => {
      const lib = await fs.readFile(eventAccessPath, 'utf-8');
      // The check must call isSuperAdminRole before any DB call so
      // super-admins never need an EventAdmin row.
      expect(lib).toMatch(/isSuperAdminRole\(session\.user\.role\)/);
      // The EventAdmin lookup must come after the super-admin gate.
      const superAdminIndex = lib.indexOf('isSuperAdminRole');
      const findUniqueIndex = lib.indexOf('eventAdmin.findUnique');
      expect(superAdminIndex).toBeGreaterThan(-1);
      expect(findUniqueIndex).toBeGreaterThan(superAdminIndex);
    });

    it('trpc.ts middleware consults isAdminRole for adminProcedure', async () => {
      const trpc = await fs.readFile(trpcPath, 'utf-8');
      // The middleware body must read isAdminRole so HOST users (with
      // EventAdmin rows) can still hit admin tRPC procedures.
      expect(trpc).toMatch(/isAdminRole\(authedCtx\.session\.user\.role\)/);
    });
  });

  describe('FPP-41 / QUB-13.2 — host assignment REST endpoint', () => {
    it('accepts userIds[] for bulk host assignment', async () => {
      const route = await fs.readFile(adminsRoutePath, 'utf-8');
      expect(route).toMatch(/userIds/);
      // The handler must gate on a non-empty target list before any DB write.
      expect(route).toMatch(/collectTargetUserIds/);
    });

    it('defaults the role to OWNER (host) when none is provided', async () => {
      const route = await fs.readFile(adminsRoutePath, 'utf-8');
      // Default to OWNER so the multi-select flow "Add N hosts"
      // always assigns hosts, never co-admins.
      expect(route).toMatch(/role\s*=\s*AdminPermission\.OWNER/);
    });

    it('stamps User.role = HOST for non-super-admin OWNER assignments', async () => {
      const route = await fs.readFile(adminsRoutePath, 'utf-8');
      // The route delegates the role-stamp to the shared helper so
      // REST and tRPC stay in lockstep (reviewer issue #1).
      expect(route).toMatch(/stampHostRole\(/);
      // The conditional must gate on role === OWNER so a COADMIN
      // assignment does not silently promote the user.
      expect(route).toMatch(/role === AdminPermission\.OWNER/);
    });

    it('shared stampHostRole helper centralises the role-stamp (REST + tRPC parity)', async () => {
      const helper = await fs.readFile(eventAccessPath, 'utf-8');
      expect(helper).toMatch(/export async function stampHostRole/);
      // The helper must filter out super-admins so they are never
      // silently downgraded to HOST.
      expect(helper).toMatch(/role:\s*\{ not: Role\.SUPER_ADMIN \}/);
    });

    it('writes a per-row domain audit entry under EventAdmin subject', async () => {
      const route = await fs.readFile(adminsRoutePath, 'utf-8');
      expect(route).toMatch(/writeDomainAuditLog/);
      expect(route).toMatch(/subjectType:\s*'EventAdmin'/);
      expect(route).toMatch(/subjectId:\s*`\$\{eventId\}:\$\{row\.userId\}`/);
    });

    it('emits a structured host-assignment notification stub to the logger', async () => {
      const route = await fs.readFile(adminsRoutePath, 'utf-8');
      expect(route).toMatch(/createRequestLogger/);
      expect(route).toMatch(/host-assignment-notification/);
      // The body must be null per the spec — "body TBD; no real send yet".
      expect(route).toMatch(/body:\s*null/);
    });
  });

  describe('FPP-41 / QUB-13.2 — host assignment UI', () => {
    it('EventAdminsClient exposes the multi-host picker', async () => {
      const client = await fs.readFile(eventAdminsClientPath, 'utf-8');
      // Hosts section renders before "Other admins" so the user-facing
      // concept leads the page.
      const hostsIndex = client.indexOf('Hosts');
      const othersIndex = client.indexOf('Other Admins');
      expect(hostsIndex).toBeGreaterThan(-1);
      expect(othersIndex).toBeGreaterThan(hostsIndex);
      // The multi-select surface must POST `userIds[]` with role=OWNER.
      expect(client).toMatch(/userIds: selectedHosts\.map\(\(u\) => u\.id\)/);
      expect(client).toMatch(/role: 'OWNER'/);
    });

    it('drives the host picker from the existing /api/admin/users/search?q= route', async () => {
      const client = await fs.readFile(eventAdminsClientPath, 'utf-8');
      expect(client).toMatch(/api\/admin\/users\/search\?q=/);
    });
  });

  describe('FPP-40 / QUB-13.3 — host contact details on event page', () => {
    it('event page loads EventAdmin rows with role=OWNER for the public surface', async () => {
      const page = await fs.readFile(eventPagePath, 'utf-8');
      expect(page).toMatch(/AdminPermission\.OWNER/);
      // The page must narrow the User select to the public contact
      // channels (name, email, phoneNumber) — no household, no role.
      expect(page).toMatch(/phoneNumber:\s*true/);
    });

    it('event page passes hosts into EventHeaderSection', async () => {
      const page = await fs.readFile(eventPagePath, 'utf-8');
      expect(page).toMatch(/hosts=\{hosts\}/);
    });

    it('HostBlock renders host name + email + phone when present', async () => {
      const section = await fs.readFile(eventHeaderSectionPath, 'utf-8');
      // The component must declare a `hosts` prop.
      expect(section).toMatch(
        /hosts:\s*\{[\s\S]*?name: string;[\s\S]*?email: string;[\s\S]*?phoneNumber: string \| null/,
      );
      // The block must hide itself when no host is assigned (per spec).
      expect(section).toMatch(/hosts\.length > 0/);
      // The block must render the email as a mailto link and the phone as a tel link.
      expect(section).toMatch(/mailto:\$\{host\.email\}/);
      expect(section).toMatch(/tel:\$\{host\.phoneNumber\}/);
    });
  });

  // Reviewer issues #1, #2, #3, #4: tRPC parity with the REST
  // host-assignment contract.
  describe('FPP-41 / QUB-13.2 — host assignment tRPC parity', () => {
    it('tRPC addAdmin defaults role to OWNER, matching REST', async () => {
      const router = await fs.readFile(eventRouterPath, 'utf-8');
      expect(router).toMatch(/\.default\(AdminPermission\.OWNER\)/);
    });

    it('tRPC addAdmin calls stampHostRole inside the create transaction', async () => {
      const router = await fs.readFile(eventRouterPath, 'utf-8');
      // The helper is imported at module scope and invoked only
      // when the role resolves to OWNER.
      expect(router).toMatch(/import \{[^}]*stampHostRole[^}]*\} from '~\/lib\/event-access'/);
      expect(router).toMatch(/stampHostRole\(\[\s*input\.userId\s*\], tx\)/);
      expect(router).toMatch(/if\s*\(\s*input\.role === AdminPermission\.OWNER\s*\)/);
    });
  });

  // FPP-65 audit followup: remove HOST from `ADMIN_ROLES`, wire
  // `eventAdminProcedure` per-event gating, un-stamp HOST role on
  // removal, and gate the REST admins routes with `requireEventAdminApi`.
  describe('FPP-65 audit — host scoping fix', () => {
    it('ADMIN_ROLES excludes HOST so a host cannot unlock global admin access', async () => {
      const auth = await fs.readFile(authLibPath, 'utf-8');
      // The audit team's read: HOST was added to ADMIN_ROLES in the
      // original PR, which gave any host global admin access. That
      // contradicted the FPP-65 spec ("scoped to events they have
      // an EventAdmin row for"). The fix removes HOST from the set.
      expect(auth).toMatch(/ADMIN_ROLES:\s*readonly Role\[\]\s*=\s*\['SUPER_ADMIN',\s*'ADMIN'\]/);
      // Defensive: HOST must not appear in the literal — future
      // case-insensitive grep would also catch the trailing comma.
      const adminRolesDecl = auth.match(/ADMIN_ROLES:\s*readonly Role\[\]\s*=\s*\[([^\]]+)\]/);
      expect(adminRolesDecl).not.toBeNull();
      expect(adminRolesDecl![1]!).not.toMatch(/HOST/);
    });

    it('defines eventAdminProcedure builder that uses canAccessEvent for per-event gate', async () => {
      const trpc = await fs.readFile(trpcPath, 'utf-8');
      expect(trpc).toMatch(/export function eventAdminProcedure/);
      // The builder must consult canAccessEvent so a HOST with an
      // EventAdmin row can pass. FPP-104 refactored the call site
      // to compute the eventId once (`const eventId = await
      // getEventId(...)`) and feed it into canAccessEvent, so the
      // test accepts either the older inline form or the
      // FPP-104 named-variable form. The exact phrasing of the
      // short-circuit may vary; we just need both branches
      // touching the same `next()` call.
      const builderSlice = trpc.split(/export function eventAdminProcedure/)[1] ?? '';
      expect(builderSlice).toMatch(/isAdminRole\(role\)/);
      // Match either the inline form (canAccessEvent(ctx.session,
      // getEventId(input...))) or the FPP-104 refactored form
      // (canAccessEvent(ctx.session, eventId)).
      expect(builderSlice).toMatch(
        /canAccessEvent\(ctx\.session, (?:\s*getEventId\(input|eventId\s*\))/,
      );
      expect(builderSlice).toMatch(/throw new TRPCError\(\{ code: 'FORBIDDEN' \}\)/);
    });

    it('event.router.ts uses eventAdminProcedure for every event-scoped mutation', async () => {
      const router = await fs.readFile(eventRouterPath, 'utf-8');
      // The six event-scoped mutations must all use the new builder.
      // A regression that drops one back to auditedAdminProcedure
      // would re-introduce the global-admin-as-host bug.
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
      // And none of them should fall back to the old global admin
      // builder for any of these event-scoped names.
      expect(router).not.toMatch(/update:\s*auditedAdminProcedure/);
      expect(router).not.toMatch(/publish:\s*auditedAdminProcedure/);
      expect(router).not.toMatch(/close:\s*auditedAdminProcedure/);
      expect(router).not.toMatch(/cancel:\s*auditedAdminProcedure/);
    });

    it('REST POST admins route uses requireEventAdminApi (per-event gate)', async () => {
      const route = await fs.readFile(adminsRoutePath, 'utf-8');
      expect(route).toMatch(/requireEventAdminApi\(eventId\)/);
      // The handler must NOT call the global requireAdminApi any more.
      expect(route).not.toMatch(/requireAdminApi\(\)/);
    });

    it('REST POST admins route rejects HOST self-assignment', async () => {
      const route = await fs.readFile(adminsRoutePath, 'utf-8');
      // FPP-104: tightened to use `isSuperAdminRole` so an
      // ADMIN user cannot self-promote to OWNER on an event
      // they already have a row for. The error message was updated
      // to reflect the new "only super-admins" framing.
      const actorCheck = route.match(/const actorIsSuperAdmin[\s\S]*?\);/);
      expect(actorCheck).not.toBeNull();
      expect(actorCheck![0]!).toMatch(/isSuperAdminRole/);
      // A non-super-admin actor cannot include themselves in the
      // target list. The check must run before any DB write.
      expect(route).toMatch(/only super-admins can self-assign via this endpoint/);
    });

    it('REST DELETE admins route uses requireEventAdminApi + un-stamp on OWNER removal', async () => {
      const route = await fs.readFile(
        path.join(process.cwd(), 'src/app/api/admin/events/[id]/admins/[userId]/route.ts'),
        'utf-8',
      );
      expect(route).toMatch(/requireEventAdminApi\(eventId\)/);
      expect(route).toMatch(/unassignHostRole\(/);
    });

    it('unassignHostRole demotes HOST to ADULT when no OWNER rows remain', async () => {
      const helper = await fs.readFile(eventAccessPath, 'utf-8');
      expect(helper).toMatch(/export async function unassignHostRole/);
      // The check must gate on zero remaining OWNER rows so a user
      // who still hosts another event keeps their HOST role.
      expect(helper).toMatch(/eventAdmin\.count\(\{[\s\S]*?role: AdminPermission\.OWNER/);
      // The demotion target record must be ADULT, not HOST.
      expect(helper).toMatch(/data:\s*\{\s*role:\s*Role\.ADULT\s*\}/);
    });

    it('admin UI event-edit pages use requireEventAdminPage (per-event gate)', async () => {
      const editPage = await fs.readFile(
        path.join(process.cwd(), 'src/app/admin/events/[id]/edit/page.tsx'),
        'utf-8',
      );
      const adminsPage = await fs.readFile(
        path.join(process.cwd(), 'src/app/admin/events/[id]/edit/admins/page.tsx'),
        'utf-8',
      );
      const membersPage = await fs.readFile(
        path.join(process.cwd(), 'src/app/admin/events/[id]/members/page.tsx'),
        'utf-8',
      );
      for (const file of [editPage, adminsPage, membersPage]) {
        expect(file).toMatch(/requireEventAdminPage\(id\)/);
        expect(file).not.toMatch(/await requireAdminPage\(\)/);
      }
    });

    it('itinerary REST routes (PR #66) use requireEventAdminApi', async () => {
      // Reviewer note: PR #66 itinerary routes gated on
      // requireAdminApi. With Option A, they must use the per-event
      // gate so hosts can curate their own itinerary.
      const routes = [
        'src/app/api/admin/itinerary-items/route.ts',
        'src/app/api/admin/itinerary-items/[id]/route.ts',
        'src/app/api/admin/itinerary-items/reorder/route.ts',
      ];
      for (const routePath of routes) {
        const content = await fs.readFile(path.join(process.cwd(), routePath), 'utf-8');
        expect(content).toMatch(/requireEventAdminApi\(/);
        // Defensive: the global admin gate must NOT remain on these
        // routes. A regression would re-introduce the original
        // audit finding.
        expect(content).not.toMatch(/requireAdminApi\(\)/);
      }
    });
  });
});
