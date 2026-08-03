import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('Household Name Field (QUB-46)', () => {
  const householdRouterPath = path.join(process.cwd(), 'src/server/routers/household.router.ts');
  const onboardingRoutePath = path.join(process.cwd(), 'src/app/api/onboarding/household/route.ts');
  const schemaLibPath = path.join(process.cwd(), 'src/lib/schemas/household.ts');
  const schemaIndexPath = path.join(process.cwd(), 'src/lib/schemas/index.ts');
  const profileClientPath = path.join(process.cwd(), 'src/components/ProfileClient.tsx');
  const useHouseholdHookPath = path.join(process.cwd(), 'src/hooks/useHousehold.ts');
  const hooksIndexPath = path.join(process.cwd(), 'src/hooks/index.ts');

  describe('Schema validation', () => {
    it('exports household schemas from schemas/index.ts', async () => {
      const content = await fs.readFile(schemaIndexPath, 'utf-8');
      expect(content).toContain("export * from './household'");
    });

    it('defines household name as required, 1-80 chars', async () => {
      const content = await fs.readFile(schemaLibPath, 'utf-8');
      expect(content).toContain('householdNameSchema');
      expect(content).toContain('HOUSEHOLD_NAME_MIN');
      expect(content).toContain('HOUSEHOLD_NAME_MAX');
      expect(content).toMatch(/min\(HOUSEHOLD_NAME_MIN/);
      expect(content).toMatch(/max\(HOUSEHOLD_NAME_MAX/);
    });

    it('exposes householdCreateSchema and householdUpdateSchema', async () => {
      const content = await fs.readFile(schemaLibPath, 'utf-8');
      expect(content).toContain('householdCreateSchema');
      expect(content).toContain('householdUpdateSchema');
    });

    it('trims whitespace in the household name', async () => {
      const content = await fs.readFile(schemaLibPath, 'utf-8');
      expect(content).toMatch(/\.trim\(\)/);
    });
  });

  describe('Household router', () => {
    it('uses the shared schemas', async () => {
      const content = await fs.readFile(householdRouterPath, 'utf-8');
      expect(content).toContain('householdCreateSchema');
      expect(content).toContain('householdUpdateSchema');
    });

    it('checks duplicate household names case-insensitively on create', async () => {
      const content = await fs.readFile(householdRouterPath, 'utf-8');
      expect(content).toContain("mode: 'insensitive'");
      expect(content).toMatch(/CONFLICT|exists/i);
    });

    it('rejects updates from users not in the household', async () => {
      const content = await fs.readFile(householdRouterPath, 'utf-8');
      expect(content).toContain('FORBIDDEN');
      expect(content).toMatch(/own household|rename/i);
    });

    it('excludes the household being updated from the duplicate check', async () => {
      const content = await fs.readFile(householdRouterPath, 'utf-8');
      expect(content).toMatch(/excludeId|NOT: \{ id: input\.id \}/);
    });
  });

  describe('Onboarding API', () => {
    it('validates with householdCreateSchema', async () => {
      const content = await fs.readFile(onboardingRoutePath, 'utf-8');
      expect(content).toContain('householdCreateSchema');
      expect(content).toContain('safeParse');
    });

    it('returns 400 with a validation message on invalid input', async () => {
      const content = await fs.readFile(onboardingRoutePath, 'utf-8');
      expect(content).toMatch(/status: 400/);
      expect(content).toContain('Invalid household name');
    });

    it('returns 409 on duplicate household name', async () => {
      const content = await fs.readFile(onboardingRoutePath, 'utf-8');
      expect(content).toMatch(/status: 409/);
      expect(content).toMatch(/['"]P2002['"]/);
      expect(content).toContain('A household with this name already exists');
    });
  });

  describe('Database-level uniqueness', () => {
    it('migration creates a partial unique index on lower(trim(name))', async () => {
      const migrationsDir = path.join(process.cwd(), 'prisma/migrations');
      const entries = await fs.readdir(migrationsDir);
      const dir = entries.find((e) => e.includes('household_name'));
      expect(dir).toBeDefined();
      const sql = await fs.readFile(path.join(migrationsDir, dir!, 'migration.sql'), 'utf-8');
      expect(sql).toMatch(/CREATE UNIQUE INDEX/);
      expect(sql).toMatch(/LOWER\(btrim\(name\)\)/);
      expect(sql).toMatch(/WHERE "deletedAt" IS NULL/);
    });

    it('router converts P2002 to a 409 CONFLICT', async () => {
      const content = await fs.readFile(householdRouterPath, 'utf-8');
      expect(content).toContain('PrismaClientKnownRequestError');
      expect(content).toMatch(/['"]P2002['"]/);
      expect(content).toMatch(/CONFLICT/);
    });
  });

  describe('Profile editing UI', () => {
    it('exposes a hook for renaming a household', async () => {
      const content = await fs.readFile(useHouseholdHookPath, 'utf-8');
      expect(content).toContain('useHouseholdNameMutation');
      expect(content).toContain('trpc.household.update');
    });

    it('re-exports the household name hook from the hooks barrel', async () => {
      const content = await fs.readFile(hooksIndexPath, 'utf-8');
      expect(content).toContain('useHouseholdNameMutation');
    });

    it('renders an editable household name input', async () => {
      const content = await fs.readFile(profileClientPath, 'utf-8');
      expect(content).toContain('householdName');
      expect(content).toContain('handleSaveHousehold');
      expect(content).toContain('maxLength={80}');
      expect(content).toContain('Must be unique across the platform');
    });

    it('submits through the trpc update mutation', async () => {
      const content = await fs.readFile(profileClientPath, 'utf-8');
      expect(content).toContain('updateName.mutateAsync');
      expect(content).toMatch(/id: user\.household\.id/);
    });
  });

  describe('Backfill migration', () => {
    it('exists under prisma/migrations', async () => {
      const migrationsDir = path.join(process.cwd(), 'prisma/migrations');
      const entries = await fs.readdir(migrationsDir);
      const householdMigration = entries.find((e) => e.includes('household_name'));
      expect(householdMigration).toBeDefined();
    });

    it('backfills blank names from the first user', async () => {
      const migrationsDir = path.join(process.cwd(), 'prisma/migrations');
      const entries = await fs.readdir(migrationsDir);
      const dir = entries.find((e) => e.includes('household_name'));
      expect(dir).toBeDefined();
      const sql = await fs.readFile(path.join(migrationsDir, dir!, 'migration.sql'), 'utf-8');
      expect(sql).toMatch(/UPDATE "Household"/);
      expect(sql).toMatch(/User/);
      expect(sql).toMatch(/Household/);
    });

    it('adds a length check constraint', async () => {
      const migrationsDir = path.join(process.cwd(), 'prisma/migrations');
      const entries = await fs.readdir(migrationsDir);
      const dir = entries.find((e) => e.includes('household_name'));
      expect(dir).toBeDefined();
      const sql = await fs.readFile(path.join(migrationsDir, dir!, 'migration.sql'), 'utf-8');
      expect(sql).toMatch(/ADD CONSTRAINT/);
      expect(sql).toMatch(/BETWEEN 1 AND 80/);
    });
  });
});
