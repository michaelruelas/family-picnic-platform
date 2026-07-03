import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/lib/generated/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  console.log('Seeding database…');

  const TEST_PASSWORD = 'password123';

  // Admin account
  const admin = await prisma.user.upsert({
    where: { email: 'admin@family-picnic.example.com' },
    update: {},
    create: {
      email: 'admin@family-picnic.example.com',
      name: 'Admin',
      role: 'ADMIN',
      devPassword: TEST_PASSWORD,
    },
  });

  console.log('Admin:', admin.email);

  // Household 1 - The Garcia Family
  const garciaHousehold = await prisma.household.create({
    data: { name: 'The Garcia Family' },
  });

  const mariaGarcia = await prisma.user.upsert({
    where: { email: 'maria.garcia@example.com' },
    update: {},
    create: {
      email: 'maria.garcia@example.com',
      name: 'Maria Garcia',
      role: 'ADMIN_ADULT',
      householdId: garciaHousehold.id,
      devPassword: TEST_PASSWORD,
    },
  });

  const carlosGarcia = await prisma.user.upsert({
    where: { email: 'carlos.garcia@example.com' },
    update: {},
    create: {
      email: 'carlos.garcia@example.com',
      name: 'Carlos Garcia',
      role: 'ADMIN_ADULT',
      householdId: garciaHousehold.id,
      devPassword: TEST_PASSWORD,
    },
  });

  console.log('Household 1:', garciaHousehold.name);
  console.log('  -', mariaGarcia.email);
  console.log('  -', carlosGarcia.email);

  // Household 2 - The Thompson Family
  const thompsonHousehold = await prisma.household.create({
    data: { name: 'The Thompson Family' },
  });

  const lisaThompson = await prisma.user.upsert({
    where: { email: 'lisa.thompson@example.com' },
    update: {},
    create: {
      email: 'lisa.thompson@example.com',
      name: 'Lisa Thompson',
      role: 'ADMIN_ADULT',
      householdId: thompsonHousehold.id,
      devPassword: TEST_PASSWORD,
    },
  });

  const bobThompson = await prisma.user.upsert({
    where: { email: 'bob.thompson@example.com' },
    update: {},
    create: {
      email: 'bob.thompson@example.com',
      name: 'Bob Thompson',
      role: 'ADMIN_ADULT',
      householdId: thompsonHousehold.id,
      devPassword: TEST_PASSWORD,
    },
  });

  console.log('Household 2:', thompsonHousehold.name);
  console.log('  -', lisaThompson.email);
  console.log('  -', bobThompson.email);

  // Household 3 - The Patel Family
  const patelHousehold = await prisma.household.create({
    data: { name: 'The Patel Family' },
  });

  const priyaPatel = await prisma.user.upsert({
    where: { email: 'priya.patel@example.com' },
    update: {},
    create: {
      email: 'priya.patel@example.com',
      name: 'Priya Patel',
      role: 'ADMIN_ADULT',
      householdId: patelHousehold.id,
      devPassword: TEST_PASSWORD,
    },
  });

  console.log('Household 3:', patelHousehold.name);
  console.log('  -', priyaPatel.email);

  console.log('');
  console.log('=== TEST ACCOUNTS ===');
  console.log('All passwords: password123');
  console.log('');
  console.log('Admin:  admin@family-picnic.example.com');
  console.log('');
  console.log('Users (for testing end-user experience):');
  console.log('  maria.garcia@example.com');
  console.log('  carlos.garcia@example.com');
  console.log('  lisa.thompson@example.com');
  console.log('  bob.thompson@example.com');
  console.log('  priya.patel@example.com');
  console.log('====================');
  console.log('');

  const dependent = await prisma.dependent.create({
    data: {
      name: 'Sofia Garcia',
      relationship: 'CHILD',
      age: 7,
      isChild: true,
      dietaryLabels: ['nut-free', 'dairy-free'],
      householdId: garciaHousehold.id,
      managedByUserId: mariaGarcia.id,
    },
  });

  console.log('Created dependent:', dependent.name);

  const event = await prisma.event.create({
    data: {
      name: 'Annual Family Picnic',
      description: 'Our annual family gathering — food, games, and memories.',
      date: new Date('2026-08-15T11:00:00Z'),
      location: 'Riverside Park, Shelter #3',
      rsvpDeadline: new Date('2026-08-01T23:59:59Z'),
      status: 'PUBLISHED',
      maxCapacity: 50,
    },
  });

  console.log('Created event:', event.name);

  await prisma.potluckSlot.create({
    data: {
      eventId: event.id,
      category: 'MAIN',
      name: 'Grilled Burgers & Hot Dogs',
      slotType: 'UNLIMITED',
    },
  });

  const sideSlot = await prisma.potluckSlot.create({
    data: {
      eventId: event.id,
      category: 'SIDE',
      name: 'Potato Salad',
      slotType: 'LIMITED',
      maxSignups: 3,
      currentSignups: 0,
    },
  });

  const dessertSlot = await prisma.potluckSlot.create({
    data: {
      eventId: event.id,
      category: 'DESSERT',
      name: 'Brownies',
      slotType: 'LIMITED',
      maxSignups: 5,
      currentSignups: 0,
    },
  });

  console.log('Created potluck slots');

  const rsvp1 = await prisma.rSVP.create({
    data: {
      eventId: event.id,
      userId: mariaGarcia.id,
      householdId: garciaHousehold.id,
      status: 'CONFIRMED',
      headcount: 3,
      dietaryNotes: 'One child is nut-free and dairy-free',
      respondedAt: new Date('2026-07-01T10:00:00Z'),
    },
  });

  await prisma.rSVP.create({
    data: {
      eventId: event.id,
      userId: lisaThompson.id,
      householdId: thompsonHousehold.id,
      status: 'CONFIRMED',
      headcount: 2,
      dietaryNotes: 'Vegetarian options please',
      respondedAt: new Date('2026-07-01T11:00:00Z'),
    },
  });

  console.log('Created RSVPs for Garcia and Thompson families');

  await prisma.potluckSignup.create({
    data: {
      slotId: sideSlot.id,
      rsvpId: rsvp1.id,
      dishName: 'Classic Potato Salad',
      servings: 2,
      dietaryLabels: ['gluten-free'],
    },
  });

  await prisma.potluckSlot.update({
    where: { id: sideSlot.id },
    data: { currentSignups: 2 },
  });

  await prisma.potluckSignup.create({
    data: {
      slotId: dessertSlot.id,
      rsvpId: rsvp1.id,
      dishName: 'Fudgy Brownies',
      servings: 1,
      dietaryLabels: ['nut-free', 'dairy-free'],
    },
  });

  await prisma.potluckSlot.update({
    where: { id: dessertSlot.id },
    data: { currentSignups: 1 },
  });

  console.log('Created potluck signups');

  const photoSeeds = [
    { seed: 100, caption: 'The family arriving at the park' },
    { seed: 200, caption: 'Kids playing frisbee' },
    { seed: 300, caption: 'Setting up the picnic area' },
    { seed: 400, caption: 'Grilling session' },
  ];

  for (const { seed, caption } of photoSeeds) {
    const photo = await prisma.photo.create({
      data: {
        eventId: event.id,
        uploadedByUserId: mariaGarcia.id,
        householdId: garciaHousehold.id,
        photoPrismId: `photo-prism-${seed}`,
        url: `https://picsum.photos/seed/${seed}/800/600`,
        thumbnailUrl: `https://picsum.photos/seed/${seed}/400/300`,
        caption,
      },
    });

    await prisma.photoReaction.createMany({
      data: [
        { photoId: photo.id, userId: mariaGarcia.id, reaction: '❤️' },
        { photoId: photo.id, userId: carlosGarcia.id, reaction: '😍' },
      ],
    });
  }

  console.log('Created photos with reactions');

  // Invitations for un-RSVPed households
  await prisma.invitation.upsert({
    where: { token: 'seed-invitation-token-patels' },
    update: {},
    create: {
      eventId: event.id,
      householdId: patelHousehold.id,
      invitedByUserId: admin.id,
      status: 'PENDING',
      token: 'seed-invitation-token-patels',
      expiresAt: new Date('2026-08-01T23:59:59Z'),
    },
  });

  console.log('Created pending invitation for Patel family');

  console.log('');
  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
