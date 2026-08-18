import { useMutation } from '@tanstack/react-query';
import { trpc } from '~/lib/trpc-client';
import { track } from '~/lib/analytics';

interface UseHouseholdReturn {
  household: ReturnType<typeof trpc.household.getById.useQuery>['data'];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface UseHouseholdOptions {
  householdId: string;
}

export function useHousehold({ householdId }: UseHouseholdOptions): UseHouseholdReturn {
  const { data, isLoading, error, refetch } = trpc.household.getById.useQuery(
    { id: householdId },
    { enabled: !!householdId },
  );

  return {
    household: data,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

interface UseHouseholdCumulativeHeadcountReturn {
  data: {
    totalHeadcount: number;
    byEvent: Array<{
      eventId: string;
      eventName: string;
      eventDate: Date;
      headcount: number;
    }>;
  };
  isLoading: boolean;
  error: Error | null;
}

interface UseHouseholdCumulativeHeadcountOptions {
  householdId: string;
}

export function useHouseholdCumulativeHeadcount({
  householdId,
}: UseHouseholdCumulativeHeadcountOptions): UseHouseholdCumulativeHeadcountReturn {
  const { data, isLoading, error } = trpc.household.getCumulativeHeadcount.useQuery(
    { householdId },
    { enabled: !!householdId },
  );

  return {
    data: data ?? { totalHeadcount: 0, byEvent: [] },
    isLoading,
    error: error as Error | null,
  };
}

export function useHouseholdNameMutation() {
  const utils = trpc.useUtils();

  const updateName = trpc.household.update.useMutation({
    onSuccess: (_data, variables) => {
      track('household_renamed', { householdId: variables.id });
      void utils.user.getProfile.invalidate();
      void utils.household.getById.invalidate();
      void utils.household.list.invalidate();
      void utils.household.getTree.invalidate();
      // The RSVP form caches the household name in its snapshot; a
      // successful rename must invalidate it so the next open shows
      // the new value rather than a stale default.
      void utils.rsvp.getRsvpFormState.invalidate();
    },
  });

  return {
    updateName,
  };
}

/**
 * FPP-36: lets the RSVP form rename an individual household member
 * through the existing `/api/household-members/[id]` PATCH endpoint.
 * The form reuses the same input schema as the household profile
 * (`householdMemberUpdateSchema`) so the trim, max-length, and
 * control-character rules stay in sync.
 */
export function useHouseholdMemberNameMutation() {
  const utils = trpc.useUtils();

  const updateName = useMutation({
    mutationFn: async (input: { id: string; name?: string; age?: number | null }) => {
      const body: Record<string, unknown> = {};
      if (input.name !== undefined) body.name = input.name;
      if (input.age !== undefined) body.age = input.age;
      const response = await fetch(`/api/household-members/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorBody?.error ?? 'Failed to rename member');
      }
      return response.json();
    },
    onSuccess: (_data, variables) => {
      track('household_member_renamed', { memberId: variables.id });
      // The RSVP form snapshot is what reads the household roster;
      // invalidating it forces the next open to pull the freshly
      // renamed member instead of the stale snapshot.
      void utils.rsvp.getRsvpFormState.invalidate();
      void utils.user.getProfile.invalidate();
      void utils.household.getById.invalidate();
    },
  });

  return {
    updateName,
  };
}
