import { trpc } from '~/lib/trpc-client';

interface UsePotluckSlotsReturn {
  slots: ReturnType<typeof trpc.potluck.listSlots.useQuery>['data'];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface UsePotluckSlotsOptions {
  eventId: string;
}

export function usePotluckSlots({ eventId }: UsePotluckSlotsOptions): UsePotluckSlotsReturn {
  const { data, isLoading, error, refetch } = trpc.potluck.listSlots.useQuery(
    { eventId },
    { enabled: !!eventId },
  );

  return {
    slots: data,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

interface UsePotluckFoodSummaryReturn {
  summary: ReturnType<typeof trpc.potluck.getFoodSummary.useQuery>['data'];
  isLoading: boolean;
  error: Error | null;
}

interface UsePotluckFoodSummaryOptions {
  eventId: string;
}

export function usePotluckFoodSummary({
  eventId,
}: UsePotluckFoodSummaryOptions): UsePotluckFoodSummaryReturn {
  const { data, isLoading, error } = trpc.potluck.getFoodSummary.useQuery(
    { eventId },
    { enabled: !!eventId },
  );

  return {
    summary: data,
    isLoading,
    error: error as Error | null,
  };
}

export function usePotluckSignupMutation() {
  const utils = trpc.useUtils();

  const invalidateAll = () => {
    void utils.potluck.listSlots.invalidate();
    void utils.potluck.getMySignups.invalidate();
  };

  const signup = trpc.potluck.signup.useMutation({
    onSuccess: invalidateAll,
  });

  const updateSignup = trpc.potluck.updateSignup.useMutation({
    onSuccess: invalidateAll,
  });

  const cancelSignup = trpc.potluck.cancelSignup.useMutation({
    onSuccess: invalidateAll,
  });

  return {
    signup,
    updateSignup,
    cancelSignup,
  };
}

export interface MyPotluckSignup {
  id: string;
  slotId: string;
  dishName: string;
  servings: number;
  dietaryLabels: string[];
  claimedAt: Date;
  slot: {
    id: string;
    name: string;
    category: string;
    slotType: string;
  };
}

interface UseMyPotluckSignupsReturn {
  signups: MyPotluckSignup[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface UseMyPotluckSignupsOptions {
  eventId: string;
  /**
   * When false, the query is disabled. The hook returns an empty
   * signup list so callers can mount unconditionally and the UI
   * still renders the rest of the page.
   */
  enabled?: boolean;
}

export function useMyPotluckSignups({
  eventId,
  enabled = true,
}: UseMyPotluckSignupsOptions): UseMyPotluckSignupsReturn {
  const { data, isLoading, error, refetch } = trpc.potluck.getMySignups.useQuery(
    { eventId },
    { enabled: enabled && !!eventId },
  );

  return {
    signups: (data ?? []) as MyPotluckSignup[],
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
