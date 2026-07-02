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

  const signup = trpc.potluck.signup.useMutation({
    onSuccess: () => {
      void utils.potluck.listSlots.invalidate();
    },
  });

  const updateSignup = trpc.potluck.updateSignup.useMutation({
    onSuccess: () => {
      void utils.potluck.listSlots.invalidate();
    },
  });

  const cancelSignup = trpc.potluck.cancelSignup.useMutation({
    onSuccess: () => {
      void utils.potluck.listSlots.invalidate();
    },
  });

  return {
    signup,
    updateSignup,
    cancelSignup,
  };
}
