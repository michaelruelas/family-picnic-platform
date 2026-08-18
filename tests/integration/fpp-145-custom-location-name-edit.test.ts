import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * FPP-145 follow-up: lock in the wiring between the admin edit
 * page and `<EventForm>` so the host's typed custom location name
 * survives a save + refresh.
 *
 * Regression in question: the edit page builds an `initialData`
 * object from the event row and hands it to `<EventForm>`. The
 * `customLocationName` column was missing from that build, so the
 * form re-mounted with an empty string even though the DB had the
 * value. Symptom: the host saves a custom name, the value lands
 * in the database, but the field on the next visit is blank.
 *
 * Structural assertions only — the runtime pre-fill behaviour is
 * covered by `src/components/event/__tests__/EventForm.test.tsx`
 * ("pre-fills the location name in edit mode").
 */
describe('FPP-145 follow-up: customLocationName round-trips through edit page', () => {
  const editPagePath = path.join(process.cwd(), 'src/app/admin/events/[id]/edit/page.tsx');

  it('feeds event.customLocationName into the form initialData', async () => {
    const content = await fs.readFile(editPagePath, 'utf-8');
    // The shape key on the right-hand side must appear in the
    // initialData block. A close-down regex is enough to catch the
    // bug — the original page was missing this key entirely.
    expect(content).toMatch(/customLocationName:\s*event\.customLocationName/);
  });

  it('falls back to an empty string when the column is null', async () => {
    const content = await fs.readFile(editPagePath, 'utf-8');
    // Legacy events (or a host that has never set a custom name)
    // land with customLocationName = NULL. The form needs an empty
    // string so the input renders empty rather than 'undefined'.
    expect(content).toMatch(/customLocationName:\s*event\.customLocationName\s*\?\?\s*''/);
  });
});
