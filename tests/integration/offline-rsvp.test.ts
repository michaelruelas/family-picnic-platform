import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('Offline RSVP Handling (SPEC §8.4)', () => {
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
    expect(content).toContain('export { useOffline }');
  });
});
