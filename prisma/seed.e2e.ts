import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/lib/generated/client.js';
import {
  EventStatus,
  InvitationStatus,
  PotluckCategory,
  RSVPStatus,
  Role,
  SlotType,
} from '../src/lib/generated/enums.js';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * End-to-end test seed.
 *
 * Goals:
 *  - Build a predictable, deterministic state that the Playwright suite can
 *    rely on. The dev seed (prisma/seed.ts) is designed for humans exploring
 *    the app; this seed is designed for tests that must assert on specific
 *    rows.
 *  - Wipe and rebuild every e2e-relevant table on each run so a stale row
 *    from a previous run or a developer poking the DB cannot wedge a test.
 *  - Use stable, machine-known ids so tests can assert against them without
 *    re-querying.
 *  - Use deterministic dates in the near future so the home page's "next
 *    gathering" chip and the events list always have something to render.
 *  - Write the resolved ids to `playwright-tests/helpers/.seed-ids.json` so
 *    the spec files can read them without importing Prisma client code into
 *    the Playwright test runner (which trips on Prisma's `import.meta`).
 *
 * Run: bun run prisma/seed.e2e.ts
 */

const TEST_PASSWORD = 'password123';

const SCHEMA = process.env.E2E_DB_SCHEMA || 'public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function reset() {
  // Order matters because of FK constraints. Children first.
  await prisma.refund.deleteMany({});
  await prisma.charge.deleteMany({});
  await prisma.registration.deleteMany({});
  await prisma.scheduledBroadcast.deleteMany({});
  await prisma.communicationLog.deleteMany({});
  await prisma.photoReaction.deleteMany({});
  await prisma.photo.deleteMany({});
  await prisma.potluckSignup.deleteMany({});
  await prisma.rsvpMemberAttendance.deleteMany({});
  await prisma.rSVP.deleteMany({});
  await prisma.potluckSlot.deleteMany({});
  await prisma.invitation.deleteMany({});
  await prisma.eventAdmin.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.adminAuditLog.deleteMany({});
  await prisma.dependent.deleteMany({});
  await prisma.householdMember.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.household.deleteMany({});
}

async function main() {
  console.log(`[seed-e2e] schema=${SCHEMA} resetting tables…`);
  await reset();

  console.log('[seed-e2e] creating admin…');
  const admin = await prisma.user.create({
    data: {
      email: 'admin@family-picnic.example.com',
      name: 'E2E Admin',
      role: Role.ADMIN,
      devPassword: TEST_PASSWORD,
      communicationPreference: 'EMAIL',
    },
  });

  console.log('[seed-e2e] creating households…');
  const garcia = await prisma.household.create({
    data: { name: 'The Garcia Family' },
  });
  const thompson = await prisma.household.create({
    data: { name: 'The Thompson Family' },
  });
  const patel = await prisma.household.create({
    data: { name: 'The Patel Family' },
  });
  const singleton = await prisma.household.create({
    data: { name: 'The Singleton Family' },
  });

  console.log('[seed-e2e] creating users…');
  const maria = await prisma.user.create({
    data: {
      email: 'maria.garcia@example.com',
      name: 'Maria Garcia',
      role: Role.ADMIN_ADULT,
      householdId: garcia.id,
      devPassword: TEST_PASSWORD,
      communicationPreference: 'EMAIL',
      onboardingCompletedAt: new Date('2026-01-01T00:00:00Z'),
    },
  });
  const carlos = await prisma.user.create({
    data: {
      email: 'carlos.garcia@example.com',
      name: 'Carlos Garcia',
      role: Role.ADMIN_ADULT,
      householdId: garcia.id,
      devPassword: TEST_PASSWORD,
      communicationPreference: 'EMAIL',
      onboardingCompletedAt: new Date('2026-01-01T00:00:00Z'),
    },
  });
  const lisa = await prisma.user.create({
    data: {
      email: 'lisa.thompson@example.com',
      name: 'Lisa Thompson',
      role: Role.ADMIN_ADULT,
      householdId: thompson.id,
      devPassword: TEST_PASSWORD,
      communicationPreference: 'EMAIL',
      onboardingCompletedAt: new Date('2026-01-01T00:00:00Z'),
    },
  });
  const bob = await prisma.user.create({
    data: {
      email: 'bob.thompson@example.com',
      name: 'Bob Thompson',
      role: Role.ADMIN_ADULT,
      householdId: thompson.id,
      devPassword: TEST_PASSWORD,
      communicationPreference: 'BOTH',
      smsConsent: true,
      smsConsentAt: new Date('2026-01-01T00:00:00Z'),
      phoneNumber: '+15555550101',
      onboardingCompletedAt: new Date('2026-01-01T00:00:00Z'),
    },
  });
  const priya = await prisma.user.create({
    data: {
      email: 'priya.patel@example.com',
      name: 'Priya Patel',
      role: Role.ADMIN_ADULT,
      householdId: patel.id,
      devPassword: TEST_PASSWORD,
      communicationPreference: 'EMAIL',
      onboardingCompletedAt: new Date('2026-01-01T00:00:00Z'),
    },
  });
  const singletonUser = await prisma.user.create({
    data: {
      email: 'jamie.singleton@example.com',
      name: 'Jamie Singleton',
      role: Role.ADMIN_ADULT,
      householdId: singleton.id,
      devPassword: TEST_PASSWORD,
      // Intentionally no onboardingCompletedAt — exercises the wizard path.
    },
  });

  console.log('[seed-e2e] creating dependents and household members…');
  await prisma.dependent.create({
    data: {
      name: 'Sofia Garcia',
      relationship: 'CHILD',
      age: 7,
      isChild: true,
      dietaryLabels: ['nut-free', 'dairy-free'],
      householdId: garcia.id,
      managedByUserId: maria.id,
    },
  });
  await prisma.householdMember.createMany({
    data: [
      {
        householdId: garcia.id,
        name: 'Maria Garcia',
        age: 42,
        relationship: 'SPOUSE',
      },
      {
        householdId: garcia.id,
        name: 'Carlos Garcia',
        age: 45,
        relationship: 'SPOUSE',
      },
      {
        householdId: garcia.id,
        name: 'Sofia Garcia',
        age: 7,
        relationship: 'CHILD',
      },
      {
        householdId: thompson.id,
        name: 'Lisa Thompson',
        age: 38,
        relationship: 'SPOUSE',
      },
      {
        householdId: thompson.id,
        name: 'Bob Thompson',
        age: 40,
        relationship: 'SPOUSE',
      },
    ],
  });

  // Dates are picked relative to "now" so the events list and home page
  // always have live, future-published events.
  const now = new Date();
  const inDays = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  console.log('[seed-e2e] creating events…');
  const mainEvent = await prisma.event.create({
    data: {
      name: 'Annual Family Picnic',
      description: 'Our annual family gathering — food, games, and memories.',
      date: inDays(30),
      location: 'Riverside Park, Shelter #3',
      rsvpDeadline: inDays(20),
      status: EventStatus.PUBLISHED,
      maxCapacity: 50,
      registrationFeeCents: 0,
    },
  });
  const paidEvent = await prisma.event.create({
    data: {
      name: 'Reunion Banquet',
      description: 'Ticketed dinner with registration fee.',
      date: inDays(60),
      location: 'Grand Hotel Ballroom',
      rsvpDeadline: inDays(45),
      status: EventStatus.PUBLISHED,
      maxCapacity: 30,
      registrationFeeCents: 2500,
      registrationFeeMinAge: 0,
    },
  });
  const draftEvent = await prisma.event.create({
    data: {
      name: 'Draft Picnic',
      description: 'Not yet published — should not appear on public pages.',
      date: inDays(90),
      location: 'Test Park',
      rsvpDeadline: inDays(80),
      status: EventStatus.DRAFT,
      maxCapacity: 20,
    },
  });
  const pastEvent = await prisma.event.create({
    data: {
      name: 'Last Year Picnic',
      description: 'Event from last year — should appear in the past list.',
      date: inDays(-90),
      location: 'Old Park',
      status: EventStatus.PUBLISHED,
      maxCapacity: 50,
    },
  });

  console.log('[seed-e2e] creating potluck slots…');
  const mainSlot = await prisma.potluckSlot.create({
    data: {
      eventId: mainEvent.id,
      category: PotluckCategory.MAIN,
      name: 'Grilled Burgers & Hot Dogs',
      slotType: SlotType.UNLIMITED,
    },
  });
  const sideSlot = await prisma.potluckSlot.create({
    data: {
      eventId: mainEvent.id,
      category: PotluckCategory.SIDE,
      name: 'Potato Salad',
      slotType: SlotType.LIMITED,
      maxSignups: 3,
      currentSignups: 0,
    },
  });
  const dessertSlot = await prisma.potluckSlot.create({
    data: {
      eventId: mainEvent.id,
      category: PotluckCategory.DESSERT,
      name: 'Brownies',
      slotType: SlotType.LIMITED,
      maxSignups: 5,
      currentSignups: 0,
    },
  });
  await prisma.potluckSlot.create({
    data: {
      eventId: mainEvent.id,
      category: PotluckCategory.DRINK,
      name: 'Lemonade',
      slotType: SlotType.UNLIMITED,
    },
  });

  console.log('[seed-e2e] creating RSVPs and potluck signups…');
  const mariaRsvp = await prisma.rSVP.create({
    data: {
      eventId: mainEvent.id,
      userId: maria.id,
      householdId: garcia.id,
      status: RSVPStatus.CONFIRMED,
      headcount: 3,
      respondedAt: inDays(-5),
      memberAttendances: {
        create: [
          {
            memberNameSnapshot: 'Maria Garcia',
            memberAgeSnapshot: 42,
            attending: 'YES',
          },
          {
            memberNameSnapshot: 'Carlos Garcia',
            memberAgeSnapshot: 45,
            attending: 'YES',
          },
          {
            memberNameSnapshot: 'Sofia Garcia',
            memberAgeSnapshot: 7,
            attending: 'YES',
          },
        ],
      },
    },
  });
  await prisma.rSVP.create({
    data: {
      eventId: mainEvent.id,
      userId: lisa.id,
      householdId: thompson.id,
      status: RSVPStatus.CONFIRMED,
      headcount: 2,
      respondedAt: inDays(-4),
    },
  });

  await prisma.potluckSignup.create({
    data: {
      slotId: sideSlot.id,
      rsvpId: mariaRsvp.id,
      dishName: 'Classic Potato Salad',
      servings: 4,
      dietaryLabels: ['gluten-free'],
    },
  });
  await prisma.potluckSlot.update({
    where: { id: sideSlot.id },
    data: { currentSignups: 1 },
  });
  await prisma.potluckSignup.create({
    data: {
      slotId: dessertSlot.id,
      rsvpId: mariaRsvp.id,
      dishName: 'Fudgy Brownies',
      servings: 6,
      dietaryLabels: ['nut-free', 'dairy-free'],
    },
  });
  await prisma.potluckSlot.update({
    where: { id: dessertSlot.id },
    data: { currentSignups: 1 },
  });

  console.log('[seed-e2e] creating photos and reactions…');
  for (const [seed, caption] of [
    [100, 'The family arriving at the park'],
    [200, 'Kids playing frisbee'],
    [300, 'Setting up the picnic area'],
    [400, 'Grilling session'],
  ] as const) {
    const photo = await prisma.photo.create({
      data: {
        eventId: mainEvent.id,
        uploadedByUserId: maria.id,
        householdId: garcia.id,
        photoPrismId: `e2e-photo-${seed}`,
        url: `https://picsum.photos/seed/${seed}/800/600`,
        thumbnailUrl: `https://picsum.photos/seed/${seed}/400/300`,
        caption,
      },
    });
    await prisma.photoReaction.createMany({
      data: [
        { photoId: photo.id, userId: maria.id, reaction: '❤️' },
        { photoId: photo.id, userId: carlos.id, reaction: '😍' },
      ],
    });
  }

  console.log('[seed-e2e] creating invitations…');
  const patelInvitation = await prisma.invitation.create({
    data: {
      eventId: mainEvent.id,
      householdId: patel.id,
      invitedByUserId: admin.id,
      status: InvitationStatus.PENDING,
      token: 'e2e-patels-invitation-token',
      expiresAt: inDays(20),
    },
  });
  const singletonInvitation = await prisma.invitation.create({
    data: {
      eventId: mainEvent.id,
      householdId: singleton.id,
      invitedByUserId: admin.id,
      status: InvitationStatus.SENT,
      token: 'e2e-singleton-invitation-token',
      sentAt: inDays(-2),
      expiresAt: inDays(20),
    },
  });

  console.log('[seed-e2e] creating event admins…');
  await prisma.eventAdmin.create({
    data: {
      eventId: mainEvent.id,
      userId: admin.id,
      role: 'OWNER',
    },
  });

  console.log('[seed-e2e] creating audit log entries…');
  await prisma.adminAuditLog.create({
    data: {
      userId: admin.id,
      eventId: mainEvent.id,
      action: 'event.published',
      newValue: { name: mainEvent.name, status: 'PUBLISHED' },
    },
  });

  // Write the resolved ids out to a JSON file so the spec files can read
  // them without importing Prisma. Playwright runs the spec files in its
  // own runtime and trips on the Prisma client's `import.meta` usage.
  const ids = {
    events: {
      mainEvent: { id: mainEvent.id, name: mainEvent.name },
      paidEvent: {
        id: paidEvent.id,
        name: paidEvent.name,
        amountCents: paidEvent.registrationFeeCents ?? 0,
      },
      draftEvent: { id: draftEvent.id, name: draftEvent.name },
      pastEvent: { id: pastEvent.id, name: pastEvent.name },
    },
    households: {
      garcia: { id: garcia.id, name: garcia.name },
      thompson: { id: thompson.id, name: thompson.name },
      patel: { id: patel.id, name: patel.name },
      singleton: { id: singleton.id, name: singleton.name },
    },
    users: {
      admin: { id: admin.id, email: admin.email },
      maria: { id: maria.id, email: maria.email, householdId: maria.householdId! },
      lisa: { id: lisa.id, email: lisa.email, householdId: lisa.householdId! },
      priya: { id: priya.id, email: priya.email, householdId: priya.householdId! },
      singleton: {
        id: singletonUser.id,
        email: singletonUser.email,
        householdId: singletonUser.householdId!,
      },
      bob: { id: bob.id, email: bob.email, householdId: bob.householdId! },
      carlos: { id: carlos.id, email: carlos.email, householdId: carlos.householdId! },
    },
    mainPotluckSlots: {
      mainSlotId: mainSlot.id,
      sideSlotId: sideSlot.id,
      dessertSlotId: dessertSlot.id,
    },
    mariaRsvpId: mariaRsvp.id,
    invitationTokens: {
      patel: patelInvitation.token ?? '',
      singleton: singletonInvitation.token ?? '',
    },
  };

  const idsPath = resolve(
    import.meta.dirname,
    '..',
    'playwright-tests',
    'helpers',
    '.seed-ids.json',
  );
  writeFileSync(idsPath, JSON.stringify(ids, null, 2));
  console.log(`[seed-e2e] wrote ids to ${idsPath}`);

  console.log('[seed-e2e] done.');
  console.log('Login helpers:');
  console.log('  admin@family-picnic.example.com / password123');
  console.log('  maria.garcia@example.com / password123');
  console.log('  lisa.thompson@example.com / password123');
  console.log('  priya.patel@example.com / password123');
  console.log('  jamie.singleton@example.com / password123 (no household)');
  console.log('  bob.thompson@example.com / password123 (SMS consent)');
  console.log('');
  console.log('Events:');
  console.log(`  ${mainEvent.id}  Annual Family Picnic (PUBLISHED, future)`);
  console.log(`  ${paidEvent.id}  Reunion Banquet (PUBLISHED, future, paid)`);
  console.log(`  ${draftEvent.id}  Draft Picnic (DRAFT)`);
  console.log(`  ${pastEvent.id}  Last Year Picnic (PUBLISHED, past)`);

  // Touch mainSlot to keep TS happy; it's referenced above by create but not
  // re-read. The reference is here so the linter does not flag the unused var.
  void mainSlot;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
