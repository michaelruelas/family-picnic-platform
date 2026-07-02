import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('React Hooks Layer', () => {
  const hooksDir = path.join(process.cwd(), 'src/hooks');

  describe('useOffline', () => {
    const hookPath = path.join(hooksDir, 'useOffline.ts');

    it('exists and exports a useOffline function', async () => {
      const content = await fs.readFile(hookPath, 'utf-8');
      expect(content).toContain('export function useOffline()');
    });

    it('returns isOnline and lastOnline properties', async () => {
      const content = await fs.readFile(hookPath, 'utf-8');
      expect(content).toContain('isOnline: boolean');
      expect(content).toContain('lastOnline: Date | null');
    });

    it('listens to online and offline events', async () => {
      const content = await fs.readFile(hookPath, 'utf-8');
      expect(content).toContain("window.addEventListener('online'");
      expect(content).toContain("window.addEventListener('offline'");
    });

    it('handles SSR gracefully', async () => {
      const content = await fs.readFile(hookPath, 'utf-8');
      expect(content).toContain("typeof window === 'undefined'");
    });
  });

  describe('useEvent', () => {
    const hookPath = path.join(hooksDir, 'useEvent.ts');

    it('exists and exports useEvent, useEventRsvp, and useEventHeadcount', async () => {
      const content = await fs.readFile(hookPath, 'utf-8');
      expect(content).toContain('export function useEvent');
      expect(content).toContain('export function useEventRsvp');
      expect(content).toContain('export function useEventHeadcount');
    });

    it('wraps tRPC event.getById query', async () => {
      const content = await fs.readFile(hookPath, 'utf-8');
      expect(content).toContain('trpc.event.getById.useQuery');
    });

    it('wraps tRPC rsvp.getMyRsvp query', async () => {
      const content = await fs.readFile(hookPath, 'utf-8');
      expect(content).toContain('trpc.rsvp.getMyRsvp.useQuery');
    });

    it('wraps tRPC rsvp.getHeadcount query', async () => {
      const content = await fs.readFile(hookPath, 'utf-8');
      expect(content).toContain('trpc.rsvp.getHeadcount.useQuery');
    });

    it('accepts eventId parameter', async () => {
      const content = await fs.readFile(hookPath, 'utf-8');
      expect(content).toContain('eventId: string');
    });
  });

  describe('usePotluck', () => {
    const hookPath = path.join(hooksDir, 'usePotluck.ts');

    it('exists and exports usePotluckSlots and usePotluckFoodSummary', async () => {
      const content = await fs.readFile(hookPath, 'utf-8');
      expect(content).toContain('export function usePotluckSlots');
      expect(content).toContain('export function usePotluckFoodSummary');
      expect(content).toContain('export function usePotluckSignupMutation');
    });

    it('wraps tRPC potluck.listSlots query', async () => {
      const content = await fs.readFile(hookPath, 'utf-8');
      expect(content).toContain('trpc.potluck.listSlots.useQuery');
    });

    it('wraps tRPC potluck.getFoodSummary query', async () => {
      const content = await fs.readFile(hookPath, 'utf-8');
      expect(content).toContain('trpc.potluck.getFoodSummary.useQuery');
    });

    it('wraps tRPC potluck signup/updateSignup/cancelSignup mutations', async () => {
      const content = await fs.readFile(hookPath, 'utf-8');
      expect(content).toContain('trpc.potluck.signup.useMutation');
      expect(content).toContain('trpc.potluck.updateSignup.useMutation');
      expect(content).toContain('trpc.potluck.cancelSignup.useMutation');
    });
  });

  describe('useHousehold', () => {
    const hookPath = path.join(hooksDir, 'useHousehold.ts');

    it('exists and exports household hooks', async () => {
      const content = await fs.readFile(hookPath, 'utf-8');
      expect(content).toContain('export function useHousehold');
      expect(content).toContain('export function useHouseholdCumulativeHeadcount');
      expect(content).toContain('export function useDependents');
      expect(content).toContain('export function useHouseholdDependents');
      expect(content).toContain('export function useDependentMutations');
    });

    it('wraps tRPC household.getById query', async () => {
      const content = await fs.readFile(hookPath, 'utf-8');
      expect(content).toContain('trpc.household.getById.useQuery');
    });

    it('wraps tRPC household.getCumulativeHeadcount query', async () => {
      const content = await fs.readFile(hookPath, 'utf-8');
      expect(content).toContain('trpc.household.getCumulativeHeadcount.useQuery');
    });

    it('wraps tRPC dependent queries and mutations', async () => {
      const content = await fs.readFile(hookPath, 'utf-8');
      expect(content).toContain('trpc.dependent.list.useQuery');
      expect(content).toContain('trpc.dependent.getByHousehold.useQuery');
      expect(content).toContain('trpc.dependent.create.useMutation');
      expect(content).toContain('trpc.dependent.update.useMutation');
      expect(content).toContain('trpc.dependent.delete.useMutation');
    });
  });

  describe('index', () => {
    const indexPath = path.join(hooksDir, 'index.ts');

    it('exports all hooks from index', async () => {
      const content = await fs.readFile(indexPath, 'utf-8');
      expect(content).toContain('export { useOffline }');
      expect(content).toContain('export { useEvent, useEventRsvp, useEventHeadcount }');
      expect(content).toContain(
        'export { usePotluckSlots, usePotluckFoodSummary, usePotluckSignupMutation }',
      );
      expect(content).toContain('export {');
    });
  });
});
