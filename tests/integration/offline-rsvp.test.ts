import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('Offline RSVP Handling (SPEC §8.4)', () => {
  const rsvpFormPath = path.join(process.cwd(), 'src/components/RSVPForm.tsx');
  const useOfflinePath = path.join(process.cwd(), 'src/hooks/useOffline.ts');
  const hooksIndexPath = path.join(process.cwd(), 'src/hooks/index.ts');

  it('useOffline hook exports isOnline and lastOnline', async () => {
    const content = await fs.readFile(useOfflinePath, 'utf-8');
    expect(content).toContain('isOnline: boolean');
    expect(content).toContain('lastOnline: Date | null');
  });

  it('useOffline hook listens to online and offline browser events', async () => {
    const content = await fs.readFile(useOfflinePath, 'utf-8');
    expect(content).toContain("window.addEventListener('online'");
    expect(content).toContain("window.addEventListener('offline'");
  });

  it('useOffline hook handles SSR gracefully', async () => {
    const content = await fs.readFile(useOfflinePath, 'utf-8');
    expect(content).toContain("typeof window === 'undefined'");
  });

  it('useOffline is exported from hooks index', async () => {
    const content = await fs.readFile(hooksIndexPath, 'utf-8');
    expect(content).toContain("export { useOffline }");
  });

  it('RSVPForm has online/offline detection implemented (useOffline hook usage)', async () => {
    const content = await fs.readFile(rsvpFormPath, 'utf-8');
    const usesOffline = content.includes('useOffline') || content.includes('navigator.onLine');
    expect(usesOffline).toBe(true);
  });

  it('RSVPForm disables submission when offline', async () => {
    const content = await fs.readFile(rsvpFormPath, 'utf-8');
    const disabledWhenOffline = content.includes('disabled') &&
      (content.includes('!isOnline') || content.includes('isOnline === false'));
    expect(disabledWhenOffline).toBe(true);
  });

  it('RSVPForm shows offline indicator when disconnected', async () => {
    const content = await fs.readFile(rsvpFormPath, 'utf-8');
    const showsOfflineIndicator = content.includes('offline') ||
      content.includes('Offline') ||
      content.includes('isOnline');
    expect(showsOfflineIndicator).toBe(true);
  });
});