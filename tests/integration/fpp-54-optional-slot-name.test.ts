import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

const prismaSchemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
const adminRoutePath = path.join(process.cwd(), 'src/app/api/admin/potluck-slots/route.ts');
const adminPatchPath = path.join(process.cwd(), 'src/app/api/admin/potluck-slots/[id]/route.ts');
const potluckRouterPath = path.join(process.cwd(), 'src/server/routers/potluck.router.ts');
const slotFormPath = path.join(process.cwd(), 'src/components/potluck/SlotForm.tsx');
const slotGridPath = path.join(process.cwd(), 'src/components/potluck/SlotGrid.tsx');
const slotListPath = path.join(process.cwd(), 'src/components/potluck/SlotList.tsx');
const mySlotsPath = path.join(process.cwd(), 'src/components/potluck/MySlotsSummary.tsx');
const usePotluckHookPath = path.join(process.cwd(), 'src/hooks/usePotluck.ts');
const constantsPath = path.join(process.cwd(), 'src/lib/constants.ts');

describe('FPP-54 — slot name is optional (category is required)', () => {
  it('makes the PotluckSlot.name column nullable in the Prisma schema', async () => {
    const schema = await fs.readFile(prismaSchemaPath, 'utf-8');
    expect(schema).toMatch(/model\s+PotluckSlot\s*\{[\s\S]*?name\s+String\?/);
  });

  it('has a migration that drops the NOT NULL constraint on PotluckSlot.name', async () => {
    const migrationsDir = path.join(process.cwd(), 'prisma/migrations');
    const entries = await fs.readdir(migrationsDir);
    const matching = entries.filter((e) => e.includes('fpp54'));
    expect(matching.length).toBeGreaterThan(0);
    const sql = await fs.readFile(
      path.join(migrationsDir, matching[matching.length - 1]!, 'migration.sql'),
      'utf-8',
    );
    expect(sql).toMatch(/PotluckSlot/i);
    expect(sql).toMatch(/DROP\s+NOT\s+NULL/i);
  });

  it('allows the admin POST route to create a slot without a name', async () => {
    const route = await fs.readFile(adminRoutePath, 'utf-8');
    // The "name is required" branch is gone: the missing-fields guard
    // no longer mentions `name`.
    expect(route).not.toMatch(/name\s+and\s+slotType\s+are\s+required/i);
    expect(route).not.toMatch(/eventId,\s*category,\s*name,\s*and\s*slotType/);
    // Empty / whitespace-only names are normalised to null.
    expect(route).toMatch(/trimmedName\s*===\s*['"]['"]\s*\?\s*null/);
  });

  it('allows the admin PATCH route to clear a slot name by sending an empty string', async () => {
    const patch = await fs.readFile(adminPatchPath, 'utf-8');
    expect(patch).toMatch(/name\?:\s*string\s*\|\s*null/);
    expect(patch).toMatch(/trimmed\s*===\s*['"]['"]\s*\?\s*null/);
  });

  it('allows the tRPC potluck router to create a slot without a name', async () => {
    const router = await fs.readFile(potluckRouterPath, 'utf-8');
    // The zod schema for `name` is optional and transforms empty / whitespace to null.
    expect(router).toMatch(/createSlot[\s\S]*?name:[\s\S]*?z\.string\(\)[\s\S]*?\.optional\(\)/);
    expect(router).toMatch(/v\s*==\s*null\s*\|\|\s*v\s*===\s*['"]['"]\s*\?\s*null\s*:\s*v/);
  });
});

describe('FPP-54 — UI shows category + capacity for unnamed slots', () => {
  it('SlotForm no longer requires the name field', async () => {
    const form = await fs.readFile(slotFormPath, 'utf-8');
    // The label no longer carries a `*` (which marked required) and adds (optional).
    expect(form).toMatch(/Slot Name[\s\S]*?\(optional\)/);
    // The input element for `name` no longer has the `required` attribute
    // (the category select below it does, so we check the right input).
    const nameInputMatch = form.match(/<input[\s\S]*?name="name"[\s\S]*?\/>/);
    expect(nameInputMatch).not.toBeNull();
    expect(nameInputMatch![0]).not.toMatch(/\brequired\b/);
  });

  it('SlotGrid falls back to a category-derived label when name is null', async () => {
    const grid = await fs.readFile(slotGridPath, 'utf-8');
    // The placeholder helper is centralised in ~/lib/constants; both the
    // admin grid and the public list import it instead of redefining it.
    expect(grid).toMatch(/import[\s\S]*?slotDisplayName[\s\S]*?from\s+['"]~\/lib\/constants['"]/);
  });

  it('SlotList falls back to a category-derived label when name is null', async () => {
    const list = await fs.readFile(slotListPath, 'utf-8');
    expect(list).toMatch(/import[\s\S]*?slotDisplayName[\s\S]*?from\s+['"]~\/lib\/constants['"]/);
  });

  it('SlotList uses the EventSlot type with a nullable name', async () => {
    const list = await fs.readFile(slotListPath, 'utf-8');
    expect(list).toMatch(/name:\s*string\s*\|\s*null/);
  });

  it('MySlotsSummary hides the slot name segment when it is null', async () => {
    const summary = await fs.readFile(mySlotsPath, 'utf-8');
    expect(summary).toMatch(/signup\.slot\.name\s*\?/);
  });

  it('usePotluckSignups hook exposes a nullable slot.name', async () => {
    const hook = await fs.readFile(usePotluckHookPath, 'utf-8');
    expect(hook).toMatch(/name:\s*string\s*\|\s*null/);
  });

  it('keeps the existing category labels and exposes a shared slotDisplayName helper', async () => {
    const constants = await fs.readFile(constantsPath, 'utf-8');
    expect(constants).toMatch(/POTLUCK_CATEGORY_LABELS[\s\S]*?DESSERT:\s*'Desserts'/);
    // FPP-54: the placeholder helper is centralised so the public list,
    // admin grid, and any future call site stay in lockstep.
    expect(constants).toMatch(/POTLUCK_CATEGORY_INDEFINITE_ARTICLE/);
    expect(constants).toMatch(/export\s+function\s+slotDisplayName/);
  });
});
