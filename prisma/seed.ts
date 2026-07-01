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

  const event = await prisma.event.create({
    data: {
      name: 'Annual Family Picnic',
      description: 'Our annual family gathering — food, games, and memories.',
      date: new Date('2026-08-15T11:00:00Z'),
      location: 'Riverside Park, Shelter #3',
      rsvpDeadline: new Date('2026-08-01T23:59:59Z'),
    },
  });

  console.log('Created event:', event.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
