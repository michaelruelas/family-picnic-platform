import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * E2E seed fixtures. The seed (`prisma/seed.e2e.ts`) writes the resolved
 * ids to `.seed-ids.json` after every run. Spec files read them from here
 * rather than re-querying the DB.
 *
 * Reading from a JSON file (rather than importing Prisma) is deliberate:
 * the Playwright test runtime trips on the Prisma client's
 * `import.meta.url` usage. Keeping the Prisma client out of the spec
 * dependency graph avoids the failure entirely.
 */

export interface EventFixtures {
  mainEvent: { id: string; name: string };
  paidEvent: { id: string; name: string; amountCents: number };
  draftEvent: { id: string; name: string };
  pastEvent: { id: string; name: string };
}

export interface HouseholdFixtures {
  garcia: { id: string; name: string };
  thompson: { id: string; name: string };
  patel: { id: string; name: string };
  singleton: { id: string; name: string };
}

export interface UserFixtures {
  admin: { id: string; email: string };
  maria: { id: string; email: string; householdId: string };
  lisa: { id: string; email: string; householdId: string };
  priya: { id: string; email: string; householdId: string };
  singleton: { id: string; email: string; householdId: string };
  bob: { id: string; email: string; householdId: string };
  carlos: { id: string; email: string; householdId: string };
}

export interface SlotFixtures {
  mainSlotId: string;
  sideSlotId: string;
  dessertSlotId: string;
}

export interface SeedIds {
  events: EventFixtures;
  households: HouseholdFixtures;
  users: UserFixtures;
  mainPotluckSlots: SlotFixtures;
  mariaRsvpId: string;
  invitationTokens: { patel: string; singleton: string };
}

const idsPath = resolve(__dirname, '.seed-ids.json');

/**
 * Resolve the seeded ids. Reads from `.seed-ids.json` on every call.
 * The seed file is small (a few KB) and tests run sequentially, so
 * caching is not worth the staleness risk: every `reseedDatabase()` call
 * rewrites the file with fresh ids, and any cache would silently point
 * at rows that no longer exist.
 *
 * If the file is missing the seed has not run yet and the test runner
 * should be re-invoked after `bun run db:seed:e2e`.
 */
export function getFixtures(): SeedIds {
  let raw: string;
  try {
    raw = readFileSync(idsPath, 'utf-8');
  } catch {
    throw new Error(
      `e2e fixtures not found at ${idsPath}. Run \`bun run db:seed:e2e\` before running e2e tests, or run the suite via \`bun run test:e2e\` which seeds automatically.`,
    );
  }
  return JSON.parse(raw) as SeedIds;
}
