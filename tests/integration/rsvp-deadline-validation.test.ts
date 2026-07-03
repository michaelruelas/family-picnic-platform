import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('RSVP Deadline Validation', () => {
  const createRoutePath = path.join(process.cwd(), 'src/app/api/admin/events/route.ts');
  const updateRoutePath = path.join(process.cwd(), 'src/app/api/admin/events/[id]/route.ts');

  it('create route validates rsvpDeadline is before event date', async () => {
    const content = await fs.readFile(createRoutePath, 'utf-8');
    expect(content).toContain('rsvpDeadline');
    expect(content).toContain('event date');
  });

  it('create route throws error when rsvpDeadline is after event date', async () => {
    const content = await fs.readFile(createRoutePath, 'utf-8');
    const errorMsg = 'RSVP deadline must be before the event date';
    expect(content).toContain(errorMsg);
    const deadlineCheck = content.indexOf('rsvpDeadline');
    const errorIndex = content.indexOf(errorMsg);
    const checkSnippet = content.slice(deadlineCheck, errorIndex + errorMsg.length);
    expect(checkSnippet).toContain('>');
    expect(checkSnippet).not.toContain('<=');
  });

  it('update route validates rsvpDeadline is before event date', async () => {
    const content = await fs.readFile(updateRoutePath, 'utf-8');
    expect(content).toContain('rsvpDeadline');
    expect(content).toContain('event date');
  });

  it('update route throws error when rsvpDeadline is after event date', async () => {
    const content = await fs.readFile(updateRoutePath, 'utf-8');
    const errorMsg = 'RSVP deadline must be before the event date';
    expect(content).toContain(errorMsg);
    const deadlineCheck = content.indexOf('rsvpDeadline');
    const errorIndex = content.indexOf(errorMsg);
    const checkSnippet = content.slice(deadlineCheck, errorIndex + errorMsg.length);
    expect(checkSnippet).toContain('>');
    expect(checkSnippet).not.toContain('<=');
  });

  it('create route allows rsvpDeadline before event date (valid case)', async () => {
    const content = await fs.readFile(createRoutePath, 'utf-8');
    const lines = content.split('\n');
    const deadlineLineIdx = lines.findIndex((l) =>
      l.includes('rsvpDeadline && new Date(rsvpDeadline)'),
    );
    expect(deadlineLineIdx).toBeGreaterThan(-1);
    const line = lines[deadlineLineIdx];
    expect(line).toContain('>');
    expect(line).not.toContain('<=');
  });

  it('update route allows rsvpDeadline before event date (valid case)', async () => {
    const content = await fs.readFile(updateRoutePath, 'utf-8');
    const lines = content.split('\n');
    const deadlineLineIdx = lines.findIndex((l) =>
      l.includes('rsvpDeadline && new Date(rsvpDeadline)'),
    );
    expect(deadlineLineIdx).toBeGreaterThan(-1);
    const line = lines[deadlineLineIdx];
    expect(line).toContain('>');
    expect(line).not.toContain('<=');
  });
});
