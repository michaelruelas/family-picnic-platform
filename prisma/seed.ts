import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/lib/generated/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  console.log('Seeding database…');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@family-picnic.example.com' },
    update: {},
    create: {
      email: 'admin@family-picnic.example.com',
      name: 'Admin',
      role: 'ADMIN',
    },
  });

  console.log('Created admin:', admin.id);

  const household = await prisma.household.create({
    data: {
      name: 'The Johnson Family',
    },
  });

  console.log('Created household:', household.id);

  const adultUser = await prisma.user.upsert({
    where: { email: 'sarah.johnson@example.com' },
    update: {},
    create: {
      email: 'sarah.johnson@example.com',
      name: 'Sarah Johnson',
      role: 'ADMIN_ADULT',
      householdId: household.id,
    },
  });

  const childUser = await prisma.user.upsert({
    where: { email: 'mike.johnson@example.com' },
    update: {},
    create: {
      email: 'mike.johnson@example.com',
      name: 'Mike Johnson',
      role: 'ADMIN_ADULT',
      householdId: household.id,
    },
  });

  console.log('Created users:', adultUser.id, childUser.id);

  const dependent = await prisma.dependent.create({
    data: {
      name: 'Emma Johnson',
      relationship: 'CHILD',
      age: 8,
      isChild: true,
      dietaryLabels: ['nut-free'],
      householdId: household.id,
      managedByUserId: adultUser.id,
    },
  });

  console.log('Created dependent:', dependent.id);

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

  console.log('Created event:', event.id);

  const mainDishSlot = await prisma.potluckSlot.create({
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

  console.log('Created potluck slots:', mainDishSlot.id, sideSlot.id, dessertSlot.id);

  const rsvp1 = await prisma.rSVP.create({
    data: {
      eventId: event.id,
      userId: adultUser.id,
      householdId: household.id,
      status: 'CONFIRMED',
      headcount: 3,
      dietaryNotes: 'One child is nut-free',
      respondedAt: new Date('2026-07-01T10:00:00Z'),
    },
  });

  const rsvp2 = await prisma.rSVP.create({
    data: {
      eventId: event.id,
      userId: childUser.id,
      householdId: household.id,
      status: 'CONFIRMED',
      headcount: 1,
      respondedAt: new Date('2026-07-01T11:00:00Z'),
    },
  });

  console.log('Created RSVPs:', rsvp1.id, rsvp2.id);

  await prisma.potluckSignup.create({
    data: {
      slotId: sideSlot.id,
      rsvpId: rsvp1.id,
      dishName: 'Classic Potato Salad',
      servings: 2,
      dietaryLabels: ['gluten-free'],
    },
  });

  sideSlot.currentSignups = 2;
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
      dietaryLabels: ['nut-free'],
    },
  });

  dessertSlot.currentSignups = 1;
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
    { seed: 500, caption: 'Dessert spread' },
    { seed: 600, caption: 'Family group photo' },
    { seed: 700, caption: 'Sunset at the park' },
    { seed: 800, caption: 'Clean up time' },
  ];

  for (const { seed, caption } of photoSeeds) {
    const photo = await prisma.photo.create({
      data: {
        eventId: event.id,
        uploadedByUserId: adultUser.id,
        householdId: household.id,
        photoPrismId: `photo-prism-${seed}`,
        url: `https://picsum.photos/seed/${seed}/800/600`,
        thumbnailUrl: `https://picsum.photos/seed/${seed}/400/300`,
        caption,
      },
    });

    await prisma.photoReaction.createMany({
      data: [
        {
          photoId: photo.id,
          userId: adultUser.id,
          reaction: '❤️',
        },
        {
          photoId: photo.id,
          userId: childUser.id,
          reaction: '😍',
        },
      ],
    });
  }

  console.log('Created 8 photos with reactions');

  const invitation = await prisma.invitation.create({
    data: {
      eventId: event.id,
      householdId: household.id,
      invitedByUserId: admin.id,
      status: 'USED',
      token: 'seed-invitation-token-123',
      expiresAt: new Date('2026-08-01T23:59:59Z'),
      sentAt: new Date('2026-06-15T10:00:00Z'),
    },
  });

  console.log('Created invitation:', invitation.id);

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
