/**
 * Test users that the e2e seed creates. The keys match the persona so test
 * authors can write `loginAs(page, 'maria')` instead of repeating email
 * strings everywhere. The credentials match the rows written by
 * `prisma/seed.e2e.ts`.
 */
export const e2eUsers = {
  admin: {
    email: 'admin@family-picnic.example.com',
    password: 'password123',
    name: 'E2E Admin',
  },
  maria: {
    email: 'maria.garcia@example.com',
    password: 'password123',
    name: 'Maria Garcia',
    household: 'The Garcia Family',
  },
  carlos: {
    email: 'carlos.garcia@example.com',
    password: 'password123',
    name: 'Carlos Garcia',
    household: 'The Garcia Family',
  },
  lisa: {
    email: 'lisa.thompson@example.com',
    password: 'password123',
    name: 'Lisa Thompson',
    household: 'The Thompson Family',
  },
  bob: {
    email: 'bob.thompson@example.com',
    password: 'password123',
    name: 'Bob Thompson',
    household: 'The Thompson Family',
  },
  priya: {
    email: 'priya.patel@example.com',
    password: 'password123',
    name: 'Priya Patel',
    household: 'The Patel Family',
  },
  singleton: {
    email: 'jamie.singleton@example.com',
    password: 'password123',
    name: 'Jamie Singleton',
    household: 'The Singleton Family',
  },
} as const;

export type E2EUserKey = keyof typeof e2eUsers;
